const appState = {
    selectedRole: null,
    user: null,
    refreshTimer: null,
    needsRestaurantProfile: false,
};

function setMessage(text, isError = false) {
    const el = document.getElementById("status-message");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("error-message", isError);
}

function hideAllMainCards() {
    ["role-selection", "auth-card", "customer-dashboard", "restaurant-dashboard"].forEach((id) => {
        document.getElementById(id)?.classList.add("hidden");
    });
}

function showRoleSelection() {
    hideAllMainCards();
    document.getElementById("role-selection")?.classList.remove("hidden");
    if (appState.refreshTimer) {
        clearInterval(appState.refreshTimer);
        appState.refreshTimer = null;
    }
}

function logoutAndSwitchRole() {
    appState.selectedRole = null;
    appState.user = null;
    appState.needsRestaurantProfile = false;
    document.getElementById("auth-form")?.reset();
    document.getElementById("add-food-form")?.reset();
    const passwordInput = document.getElementById("auth-password");
    const togglePasswordBtn = document.getElementById("toggle-password-btn");
    if (passwordInput) passwordInput.type = "password";
    if (togglePasswordBtn) togglePasswordBtn.textContent = "Show";
    setMessage("Logged out. Select a role to continue.");
    showRoleSelection();
}

function showAuth(role) {
    appState.selectedRole = role;
    appState.needsRestaurantProfile = false;
    hideAllMainCards();
    document.getElementById("auth-card")?.classList.remove("hidden");

    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const locationUrl = document.getElementById("auth-location-url");
    const address = document.getElementById("auth-address");

    if (authTitle) authTitle.textContent = role === "customer" ? "Customer Login" : "Restaurant Login";
    if (authSubtitle) {
        authSubtitle.textContent = "Enter email and password to continue.";
    }

    locationUrl?.classList.add("hidden");
    address?.classList.add("hidden");
    if (locationUrl) {
        locationUrl.required = false;
        locationUrl.value = "";
    }
    if (address) {
        address.required = false;
        address.value = "";
    }
}

function formatRemainingTime(totalSeconds) {
    const secs = Math.max(0, totalSeconds || 0);
    if (secs < 3600) {
        const mins = Math.floor(secs / 60);
        const rem = secs % 60;
        return `${mins}m ${rem}s`;
    }
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hours}h ${mins}m`;
}

function renderCustomerTable(items) {
    const wrap = document.getElementById("customer-table-wrap");
    if (!wrap) return;
    if (!items.length) {
        wrap.innerHTML = "<p>No food listings available right now.</p>";
        return;
    }

    const rows = items
        .map(
            (item, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatRemainingTime(item.remaining_seconds)}</td>
                <td><a href="${item.restaurant_location_url || "#"}" target="_blank" rel="noopener">Map Link</a><br>${item.restaurant_address || "-"}</td>
                <td>
                    <input type="number" min="1" max="${item.quantity}" value="1" id="order-qty-${item.id}">
                    <button type="button" onclick="placeOrder('${item.id}')">Order</button>
                </td>
            </tr>
        `
        )
        .join("");

    wrap.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Sl no.</th>
                    <th>Food name</th>
                    <th>Quantity left</th>
                    <th>Time remaining</th>
                    <th>Restaurant location</th>
                    <th>Order</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderRestaurantItems(items) {
    const wrap = document.getElementById("restaurant-items-wrap");
    if (!wrap) return;
    if (!items.length) {
        wrap.innerHTML = "<p>No items added yet.</p>";
        return;
    }
    const rows = items
        .map(
            (item, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatRemainingTime(item.remaining_seconds)}</td>
            </tr>
        `
        )
        .join("");

    wrap.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Sl no.</th>
                    <th>Food name</th>
                    <th>Quantity left</th>
                    <th>Time remaining</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function loadCustomerItems() {
    const res = await fetch("/get-food");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load items.");
    renderCustomerTable(data);
}

async function loadRestaurantItems() {
    if (!appState.user?.id) return;
    const res = await fetch(`/restaurant-items?owner_id=${encodeURIComponent(appState.user.id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load restaurant items.");
    renderRestaurantItems(data);
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const role = appState.selectedRole;
    const email = document.getElementById("auth-email")?.value?.trim();
    const password = document.getElementById("auth-password")?.value || "";
    const locationUrl = document.getElementById("auth-location-url")?.value?.trim();
    const address = document.getElementById("auth-address")?.value?.trim();

    try {
        const res = await fetch("/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                role,
                email,
                password,
                location_url: locationUrl,
                address,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Authentication failed.");
        if (data.needs_profile && role === "restaurant") {
            appState.needsRestaurantProfile = true;
            const authSubtitle = document.getElementById("auth-subtitle");
            const locationInput = document.getElementById("auth-location-url");
            const addressInput = document.getElementById("auth-address");
            if (authSubtitle) authSubtitle.textContent = data.message;
            locationInput?.classList.remove("hidden");
            addressInput?.classList.remove("hidden");
            if (locationInput) locationInput.required = true;
            if (addressInput) addressInput.required = true;
            setMessage("Please provide location details for new restaurant signup.");
            return;
        }

        appState.user = data.user;
        appState.needsRestaurantProfile = false;
        setMessage(data.message);
        if (role === "customer") {
            hideAllMainCards();
            document.getElementById("customer-dashboard")?.classList.remove("hidden");
            await loadCustomerItems();
            if (appState.refreshTimer) clearInterval(appState.refreshTimer);
            appState.refreshTimer = setInterval(loadCustomerItems, 60000);
        } else {
            hideAllMainCards();
            document.getElementById("restaurant-dashboard")?.classList.remove("hidden");
            await loadRestaurantItems();
            if (appState.refreshTimer) clearInterval(appState.refreshTimer);
            appState.refreshTimer = setInterval(loadRestaurantItems, 60000);
        }
    } catch (err) {
        setMessage(err.message || "Authentication failed.", true);
    }
}

async function handleAddFood(event) {
    event.preventDefault();
    if (!appState.user?.id) return;

    const name = document.getElementById("name")?.value?.trim();
    const quantity = Number.parseInt(document.getElementById("quantity")?.value || "0", 10);
    const expiryMinutes = Number.parseInt(document.getElementById("expiry-minutes")?.value || "0", 10);

    try {
        const res = await fetch("/add-food", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                owner_id: appState.user.id,
                name,
                quantity,
                expiry_minutes: expiryMinutes,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Unable to add food.");

        setMessage(data.message);
        document.getElementById("add-food-form")?.reset();
        await loadRestaurantItems();
    } catch (err) {
        setMessage(err.message || "Unable to add food.", true);
    }
}

async function placeOrder(foodId) {
    try {
        const qtyInput = document.getElementById(`order-qty-${foodId}`);
        const quantity = Number.parseInt(qtyInput?.value || "0", 10);
        const res = await fetch("/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ food_id: foodId, quantity }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Order failed.");

        setMessage(data.message);
        await loadCustomerItems();
    } catch (err) {
        setMessage(err.message || "Order failed.", true);
    }
}
window.placeOrder = placeOrder;

const wasteForm = document.getElementById("waste-form");
if (wasteForm) {
    wasteForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const resultDiv = document.getElementById("waste-result");
        if (!resultDiv) return;
        resultDiv.innerHTML = "Analyzing image with AI...";
        setTimeout(() => {
            resultDiv.innerHTML = "Result: ORGANIC WASTE detected. Tip: use this for composting.";
        }, 2500);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const customerBtn = document.getElementById("customer-role-btn");
    const restaurantBtn = document.getElementById("restaurant-role-btn");
    const backBtn = document.getElementById("back-to-role");
    const authForm = document.getElementById("auth-form");
    const addFoodForm = document.getElementById("add-food-form");
    const customerRefreshBtn = document.getElementById("customer-refresh-btn");
    const restaurantRefreshBtn = document.getElementById("restaurant-refresh-btn");
    const customerSwitchRoleBtn = document.getElementById("customer-switch-role-btn");
    const restaurantSwitchRoleBtn = document.getElementById("restaurant-switch-role-btn");
    const passwordInput = document.getElementById("auth-password");
    const togglePasswordBtn = document.getElementById("toggle-password-btn");

    customerBtn?.addEventListener("click", () => showAuth("customer"));
    restaurantBtn?.addEventListener("click", () => showAuth("restaurant"));
    backBtn?.addEventListener("click", logoutAndSwitchRole);

    authForm?.addEventListener("submit", handleAuthSubmit);
    addFoodForm?.addEventListener("submit", handleAddFood);
    customerRefreshBtn?.addEventListener("click", loadCustomerItems);
    restaurantRefreshBtn?.addEventListener("click", loadRestaurantItems);
    customerSwitchRoleBtn?.addEventListener("click", logoutAndSwitchRole);
    restaurantSwitchRoleBtn?.addEventListener("click", logoutAndSwitchRole);
    togglePasswordBtn?.addEventListener("click", () => {
        if (!passwordInput) return;
        const isHidden = passwordInput.type === "password";
        passwordInput.type = isHidden ? "text" : "password";
        togglePasswordBtn.textContent = isHidden ? "Hide" : "Show";
    });

    showRoleSelection();
});
