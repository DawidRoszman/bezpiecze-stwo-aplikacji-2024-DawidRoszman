// export const api = "https://catnasta.dawidroszman.eu";
// export const api = "http://localhost:5000";
import process from "process";

export const api = process.env.API || "http://localhost:5000";
