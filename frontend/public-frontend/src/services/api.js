import axios from "axios";
import { API_BASE } from "../config/api";

const API = axios.create({
  baseURL: `${API_BASE}/api/`,
});

export default API;
