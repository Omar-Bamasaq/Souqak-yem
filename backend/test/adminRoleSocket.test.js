import test, { after } from "node:test";
import assert from "node:assert/strict";

const originalSecrets = {
  access: process.env.JWT_ACCESS_SECRET,
  refresh: process.env.JWT_REFRESH_SECRET
};
process.env.JWT_ACCESS_SECRET = "test-access-secret-for-admin-role-socket";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-for-admin-role-socket";

const [{ default: adminRouter }, { default: User }, socketAuthorization] = await Promise.all([
  import("../src/routes/admin.js"),
  import("../src/models/User.js"),
  import("../src/utils/socketAuthorization.js")
]);

after(() => {
  if (originalSecrets.access === undefined) delete process.env.JWT_ACCESS_SECRET;
  else process.env.JWT_ACCESS_SECRET = originalSecrets.access;
  if (originalSecrets.refresh === undefined) delete process.env.JWT_REFRESH_SECRET;
  else process.env.JWT_REFRESH_SECRET = originalSecrets.refresh;
});

test("changing a user's role disconnects their existing sockets", async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const userId = "64d3d93a1a2b3c4d5e6f7788";
  const disconnectedRooms = [];
  User.findByIdAndUpdate = () => ({
    select() {
      return { lean: async () => ({ _id: userId, role: "user" }) };
    }
  });
  const route = adminRouter.stack.find(
    (layer) => layer.route?.path === "/users/:id/role" && layer.route.methods.patch
  );
  assert.ok(route, "PATCH /users/:id/role route exists");
  const handler = route.route.stack.at(-1).handle;
  const result = { statusCode: 200, body: null };
  const res = {
    status(statusCode) { result.statusCode = statusCode; return this; },
    json(body) { result.body = body; return this; }
  };

  try {
    await handler(
      {
        params: { id: userId },
        body: { role: "user" },
        app: {
          get() {
            return {
              in(room) {
                return {
                  disconnectSockets(force) {
                    disconnectedRooms.push({ room, force });
                  }
                };
              }
            };
          }
        }
      },
      res
    );

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.role, "user");
    assert.deepEqual(disconnectedRooms, [{ room: `user:${userId}`, force: true }]);
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("a stale admin token cannot restore the admin room after demotion", () => {
  const userId = "64d3d93a1a2b3c4d5e6f7788";
  const identity = socketAuthorization.getAuthenticatedSocketUserId(
    "stale-admin-token",
    null,
    () => ({ id: userId, role: "admin" })
  );
  const rooms = new Set(["role:admin"]);
  const socket = {
    join(room) { rooms.add(room); },
    leave(room) { rooms.delete(room); }
  };

  socketAuthorization.syncSocketAdminRoom(socket, {
    role: "user",
    isDisabled: false,
    isDeleted: false
  });

  assert.equal(identity, userId);
  assert.equal(rooms.has("role:admin"), false);
});
