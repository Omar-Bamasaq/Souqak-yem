import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("admin login is a separate email form and uses the existing login endpoint", () => {
  const adminLogin = source("../AdminLogin.jsx");
  const app = source("../../App.jsx");

  assert.match(app, /path="\/admin-login"/);
  assert.match(adminLogin, /type="email"/);
  assert.match(adminLogin, /type="password"/);
  assert.match(adminLogin, /api\.post\("\/auth\/login"/);
  assert.match(adminLogin, /adminLogin:\s*true/);
  assert.match(adminLogin, /response\.data\.user\?\.role !== "admin"/);
});

test("public login remains phone-only and public navigation has no admin login link", () => {
  const publicLogin = source("../Login.jsx");
  const navBar = source("../../components/NavBar.jsx");
  const bottomNav = source("../../components/BottomNavBar.jsx");
  const registration = source("../Register.jsx");

  assert.match(publicLogin, /\/auth\/phone-login/);
  assert.doesNotMatch(publicLogin, /type="email"|emailLogin|admin-login/);
  for (const publicSurface of [navBar, bottomNav, registration]) {
    assert.doesNotMatch(publicSurface, /admin-login/);
  }
});
