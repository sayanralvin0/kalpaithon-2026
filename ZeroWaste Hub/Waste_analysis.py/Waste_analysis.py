import datetime

# Mock Data: Store waste amounts (kg) for the last 7 days per category
# Step 1: Data Storage
waste_history = {
    "Veg Meals": [5.2, 4.8, 6.1, 5.5, 5.0, 4.9, 5.3],
    "Meat Items": [3.1, 2.9, 3.5, 3.0, 3.2, 3.1, 3.3],
    "Bakery": [2.0, 2.5, 2.1, 2.2, 1.9, 2.0, 2.1]
}

# Step 2: Function to calculate 7-day average
def calculate_7day_average(category):
    if category in waste_history:
        history = waste_history[category]
        return sum(history) / len(history)
    return 0

# Step 3 & 4: Compare entry and trigger alert
def add_waste_entry(category, amount):
    avg = calculate_7day_average(category)
    threshold = avg * 1.3  # 30% increase
    
    print(f"\n--- Checking Trend for {category} ---")
    print(f"Current Entry: {amount} kg | 7-Day Avg: {avg:.2f} kg")

    if amount > threshold:
        # Step 5: Display the specific Alert
        print(f"⚠️ ALERT: High waste detected in [{category}].")
        print(f"Today: {amount} kg | Avg: {avg:.2f} kg.")
        print("Suggestion: Consider reducing preparation quantities for tomorrow.")
    else:
        print(f"✅ Waste levels for {category} are within normal range.")

# Step 6: Testing
# Test 1: Normal value
add_waste_entry("Veg Meals", 5.5)

# Test 2: Significantly higher value (Triggering the alert)
add_waste_entry("Veg Meals", 9.0)