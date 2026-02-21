import axios from "axios";

const API_BASE = (
  process.env.REACT_APP_API_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const API = axios.create({
  baseURL: `${API_BASE}/api/`,
});

export default API;
