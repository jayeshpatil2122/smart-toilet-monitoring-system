import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account Created Successfully");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert("Login Successful");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Email Authentication</h2>

      <input
        type="email"
        placeholder="Enter Email"
        onChange={(event) => setEmail(event.target.value)}
      />
      <br />
      <br />

      <input
        type="password"
        placeholder="Enter Password"
        onChange={(event) => setPassword(event.target.value)}
      />
      <br />
      <br />

      <button onClick={handleSignup}>Sign Up</button>
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}

export default Login;
