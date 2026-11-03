import { MongoClient } from "mongodb";

const databaseName = "suqaq";
const usernamePattern = /^[A-Za-z0-9._~-]+$/;
const passwordPattern = /^[A-Za-z0-9_-]{32,}$/;

const {
  MONGO_ROOT_USERNAME,
  MONGO_ROOT_PASSWORD,
  MONGO_APP_USERNAME,
  MONGO_APP_PASSWORD,
  MONGO_HOST = "mongo",
} = process.env;

if (!MONGO_ROOT_USERNAME || !usernamePattern.test(MONGO_ROOT_USERNAME)) {
  throw new Error("MONGO_ROOT_USERNAME must contain only URI-safe characters.");
}

if (!MONGO_ROOT_PASSWORD || !passwordPattern.test(MONGO_ROOT_PASSWORD)) {
  throw new Error("MONGO_ROOT_PASSWORD must be at least 32 URI-safe characters.");
}

if (!MONGO_APP_USERNAME || !usernamePattern.test(MONGO_APP_USERNAME)) {
  throw new Error("MONGO_APP_USERNAME must contain only URI-safe characters.");
}

if (!MONGO_APP_PASSWORD || !passwordPattern.test(MONGO_APP_PASSWORD)) {
  throw new Error("MONGO_APP_PASSWORD must be at least 32 URI-safe characters.");
}

function createMongoClient(username, password, authSource) {
  const uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${MONGO_HOST}:27017/${databaseName}?authSource=${authSource}`;
  return new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
}

async function createRootUserFromLocalhostException() {
  const bootstrapClient = new MongoClient("mongodb://127.0.0.1:27017/admin", {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await bootstrapClient.connect();
    const adminDatabase = bootstrapClient.db("admin");
    const userInfo = await adminDatabase.command({ usersInfo: 1 });

    if (userInfo.users?.length) {
      throw new Error("MongoDB already has users; root credentials were rejected.");
    }

    await adminDatabase.command({
      createUser: MONGO_ROOT_USERNAME,
      pwd: MONGO_ROOT_PASSWORD,
      roles: [{ role: "root", db: "admin" }],
    });
  } finally {
    await bootstrapClient.close();
  }
}

let rootClient = createMongoClient(MONGO_ROOT_USERNAME, MONGO_ROOT_PASSWORD, "admin");
const appClient = createMongoClient(
  MONGO_APP_USERNAME,
  MONGO_APP_PASSWORD,
  databaseName
);

async function verifyAppUser() {
  await appClient.connect();
  await appClient.db(databaseName).command({ ping: 1 });
  await appClient.db(databaseName).listCollections({}, { nameOnly: true }).toArray();
}

try {
  try {
    await rootClient.connect();
  } catch {
    await rootClient.close();
    await createRootUserFromLocalhostException();
    rootClient = createMongoClient(
      MONGO_ROOT_USERNAME,
      MONGO_ROOT_PASSWORD,
      "admin"
    );
    await rootClient.connect();
  }

  const appDatabase = rootClient.db(databaseName);
  const userInfo = await appDatabase.command({
    usersInfo: MONGO_APP_USERNAME,
  });
  const userExists = userInfo.users?.some(
    (user) => user.user === MONGO_APP_USERNAME
  );
  const userCommand = {
    pwd: MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: databaseName }],
  };

  if (userExists) {
    await appDatabase.command({
      updateUser: MONGO_APP_USERNAME,
      ...userCommand,
    });
  } else {
    await appDatabase.command({
      createUser: MONGO_APP_USERNAME,
      ...userCommand,
    });
  }

  await verifyAppUser();
  console.log("MongoDB application user is ready.");
} catch {
  console.error("MongoDB application user provisioning or verification failed.");
  process.exitCode = 1;
} finally {
  await Promise.allSettled([rootClient.close(), appClient.close()]);
}
