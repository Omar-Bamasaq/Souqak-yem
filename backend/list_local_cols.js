import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const LOCAL_URI = "mongodb://127.0.0.1:27017";

async function list() {
  const client = new MongoClient(LOCAL_URI);
  try {
    await client.connect();
    const db = client.db("yemen_market");
    const cols = await db.listCollections().toArray();
    console.log("Collections:", cols.map(c => c.name).join(", "));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
list();
