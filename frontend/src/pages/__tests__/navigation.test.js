import assert from "assert";

// Simulation of the logic in Messages.jsx
function simulateNavigation(state, action) {
  let { selectedId, selectedAdminId, selectedAdminMsg, adminMessages } = state;

  if (action.type === "SELECT_ADMIN") {
    selectedAdminId = action.payload;
    // The logic we added to onClick/useEffect:
    selectedId = ""; 
    const msg = adminMessages.find(m => m._id === selectedAdminId);
    selectedAdminMsg = msg;
  } 
  else if (action.type === "SELECT_CONV") {
    selectedId = action.payload;
    // The logic we added to onClick/useEffect:
    selectedAdminId = "";
    selectedAdminMsg = null;
  }

  return { selectedId, selectedAdminId, selectedAdminMsg, adminMessages };
}

const adminMessages = [
  { _id: "admin_1", title: "Welcome" },
  { _id: "admin_2", title: "Update" }
];

const initialState = {
  selectedId: "",
  selectedAdminId: "",
  selectedAdminMsg: null,
  adminMessages
};

// Test 1: Selecting an admin message
{
  const state = simulateNavigation(initialState, { type: "SELECT_ADMIN", payload: "admin_1" });
  assert.strictEqual(state.selectedAdminId, "admin_1");
  assert.strictEqual(state.selectedId, "");
  assert.strictEqual(state.selectedAdminMsg.title, "Welcome");
  console.log("Test 1 Passed: Admin message selected correctly");
}

// Test 2: Switching from admin to regular conversation
{
  const state1 = simulateNavigation(initialState, { type: "SELECT_ADMIN", payload: "admin_1" });
  const state2 = simulateNavigation(state1, { type: "SELECT_CONV", payload: "conv_123" });
  
  assert.strictEqual(state2.selectedId, "conv_123");
  assert.strictEqual(state2.selectedAdminId, "");
  assert.strictEqual(state2.selectedAdminMsg, null);
  console.log("Test 2 Passed: Switched from admin to regular conversation correctly");
}

// Test 3: Switching from regular back to admin
{
  const state1 = simulateNavigation(initialState, { type: "SELECT_CONV", payload: "conv_123" });
  const state2 = simulateNavigation(state1, { type: "SELECT_ADMIN", payload: "admin_2" });
  
  assert.strictEqual(state2.selectedAdminId, "admin_2");
  assert.strictEqual(state2.selectedId, "");
  assert.strictEqual(state2.selectedAdminMsg.title, "Update");
  console.log("Test 3 Passed: Switched from regular back to admin correctly");
}

console.log("\nAll navigation unit tests passed!");
