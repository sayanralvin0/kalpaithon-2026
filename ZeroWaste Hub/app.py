from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, redirect, render_template, request

cred = credentials.Certificate("service-key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

app = Flask(__name__)


def _user_doc_id(role, email):
    return f"{role}_{email.strip().lower().replace('.', '_')}"


def _serialize_food(doc):
    item = doc.to_dict()
    item["id"] = doc.id
    expires_at = item.get("expires_at")
    if expires_at:
        expires_dt = datetime.fromisoformat(expires_at)
        remaining_seconds = int((expires_dt - datetime.now(timezone.utc)).total_seconds())
        item["remaining_seconds"] = max(0, remaining_seconds)
    else:
        item["remaining_seconds"] = 0
    return item

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/restaurant.html")
def restaurant():
    return redirect("/")


@app.route("/waste.html")
def waste():
    return render_template("waste.html")


@app.route("/auth", methods=["POST"])
def auth():
    data = request.get_json(silent=True) or {}
    role = (data.get("role") or "").strip().lower()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if role not in {"customer", "restaurant"}:
        return jsonify({"error": "Invalid role."}), 400
    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    existing_accounts = list(db.collection("users").where("email", "==", email).stream())
    role_conflict = any((doc.to_dict() or {}).get("role") != role for doc in existing_accounts)
    if role_conflict:
        return jsonify(
            {
                "error": (
                    f"This email is already registered as a different role. "
                    f"Please login using the existing role for {email}."
                )
            }
        ), 409

    doc_id = _user_doc_id(role, email)
    user_ref = db.collection("users").document(doc_id)
    user_doc = user_ref.get()

    if user_doc.exists:
        existing_user = user_doc.to_dict()
        if existing_user.get("password") != password:
            return jsonify({"error": "Incorrect password. Please check password."}), 401
        return jsonify(
            {
                "message": "Login successful.",
                "is_new_user": False,
                "user": {"id": doc_id, "role": role, "email": email},
            }
        )

    new_user = {
        "role": role,
        "email": email,
        "password": password,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if role == "restaurant":
        location_url = (data.get("location_url") or "").strip()
        address = (data.get("address") or "").strip()
        if not location_url or not address:
            return jsonify(
                {
                    "needs_profile": True,
                    "message": "New restaurant user detected. Please provide location URL and address.",
                }
            )
        new_user["location_url"] = location_url
        new_user["address"] = address

    user_ref.set(new_user)
    return jsonify(
        {
            "message": "New account created and login successful.",
            "is_new_user": True,
            "user": {"id": doc_id, "role": role, "email": email},
        }
    )


@app.route("/add-food", methods=["POST"])
def add_food():
    data = request.get_json(silent=True) or {}
    owner_id = data.get("owner_id")
    name = (data.get("name") or "").strip()
    quantity = int(data.get("quantity") or 0)
    expiry_minutes = int(data.get("expiry_minutes") or 0)

    if not owner_id or not name or quantity <= 0 or expiry_minutes <= 0:
        return jsonify({"error": "owner_id, name, quantity, and expiry_minutes are required."}), 400

    owner_doc = db.collection("users").document(owner_id).get()
    if not owner_doc.exists:
        return jsonify({"error": "Restaurant owner not found."}), 404

    owner = owner_doc.to_dict()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
    food = {
        "name": name,
        "quantity": quantity,
        "expires_at": expires_at.isoformat(),
        "restaurant_address": owner.get("address", ""),
        "restaurant_location_url": owner.get("location_url", ""),
        "owner_id": owner_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.collection("food_items").add(food)
    return jsonify({"message": "Food listed successfully!"})


@app.route("/get-food")
def get_food():
    try:
        docs = db.collection("food_items").stream()
        foods = []
        for doc in docs:
            item = _serialize_food(doc)
            if item.get("quantity", 0) > 0 and item.get("remaining_seconds", 0) > 0:
                foods.append(item)
        return jsonify(foods)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/restaurant-items")
def restaurant_items():
    owner_id = (request.args.get("owner_id") or "").strip()
    if not owner_id:
        return jsonify({"error": "owner_id is required."}), 400
    docs = db.collection("food_items").where("owner_id", "==", owner_id).stream()
    items = [_serialize_food(doc) for doc in docs]
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return jsonify(items)


@app.route("/order", methods=["POST"])
def place_order():
    data = request.get_json(silent=True) or {}
    food_id = (data.get("food_id") or "").strip()
    requested_qty = int(data.get("quantity") or 0)
    if not food_id or requested_qty <= 0:
        return jsonify({"error": "food_id and quantity are required."}), 400

    food_ref = db.collection("food_items").document(food_id)
    food_doc = food_ref.get()
    if not food_doc.exists:
        return jsonify({"error": "Food item not found."}), 404

    current = food_doc.to_dict()
    current_qty = int(current.get("quantity", 0))
    if requested_qty > current_qty:
        return jsonify({"error": f"Only {current_qty} quantity left."}), 400

    food_ref.update({"quantity": current_qty - requested_qty})
    return jsonify({"message": "Order placed successfully. Restaurant stock updated."})

@app.route('/activity')
def show_activity():
    return render_template('activity.html')

@app.route('/check-trend', methods=['POST'])
def check_trend():
    # Step 1 & 2: 7-Day Data & Average
    history = [5.2, 4.8, 6.1, 5.5, 5.0, 4.9, 5.3]
    avg = sum(history) / len(history)
    
    # Step 3: Get today's value from form
    today_val = float(request.form.get('amount'))
    
    # Step 4: Compare (30% increase threshold)
    is_high = today_val > (avg * 1.3)
    
    result = {
        "today": today_val,
        "avg": round(avg, 2),
        "is_high": is_high
    }
    return render_template('activity.html', result=result)



if __name__ == '__main__':
    app.run(debug=True)
