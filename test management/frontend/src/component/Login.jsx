import { useEffect, useState } from "react";
import AdminDashboard from "./admin/AdminDashboard";
import TesterDashboard from "./admin/TesterDashboard";
import apiRequest from "./admin/apiRequest";

const emptyCredentials = { email: "", password: "" };
const emptyRegistration = { name: "", email: "", password: "", role: "Admin" };

export default function Login() {
  const [credentials, setCredentials] = useState(emptyCredentials);
  const [registration, setRegistration] = useState(emptyRegistration);
  const [authMode, setAuthMode] = useState("login");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    apiRequest("/api/auth/getuser", {}, token)
      .then(setUser)
      .catch(() => localStorage.removeItem("token"));
  }, []);

  const showError = (error) => {
    setIsError(true);
    setMessage(error.message || "Could not connect to the server. Check that the backend is running.");
  };

  const handleAuthentication = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    try {
      const isLogin = authMode === "login";
      const payload = isLogin ? credentials : registration;
      const result = await apiRequest(`/api/auth/${isLogin ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      localStorage.setItem("token", result.authtoken);
      const profile = isLogin
        ? await apiRequest("/api/auth/getuser", {}, result.authtoken)
        : { name: registration.name, email: payload.email, role: result.role, mustChangePassword: false };
      setUser(profile);
      setCredentials(emptyCredentials);
      setRegistration(emptyRegistration);
      setIsError(false);
      setMessage(isLogin ? "Signed in successfully." : "Account created. Welcome to TestManager!");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showError(new Error("The new passwords do not match."));
      return;
    }
    setIsSubmitting(true);
    setMessage("");
    try {
      await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      }, localStorage.getItem("token"));
      setUser({ ...user, mustChangePassword: false });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setIsError(false);
      setMessage("Your password has been changed.");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem("token");
    setUser(null);
    setMessage("");
    setCredentials(emptyCredentials);
    setAuthMode("login");
  };

  if (user?.role?.toLowerCase() === "admin" && !user.mustChangePassword) {
    return <AdminDashboard user={user} onSignOut={signOut} />;
  }

  if (user?.role?.toLowerCase() === "tester" && !user.mustChangePassword) {
    return <TesterDashboard user={user} onSignOut={signOut} />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <section className="login-left">
          <div className="brand"><div className="brand-icon">T</div><span>TestManager</span></div>
          <div className="welcome-content">
            <h1>Manage your testing with confidence.</h1>
            <p>Organize test cases, track execution, manage projects, and collaborate with your testing team in one place.</p>
            <div className="features">
              <div className="feature"><span>✓</span><p>Manage test cases efficiently</p></div>
              <div className="feature"><span>✓</span><p>Track test execution and results</p></div>
              <div className="feature"><span>✓</span><p>Upload and manage test evidence</p></div>
            </div>
          </div>
        </section>

        <section className="login-right">
          <div className="login-form-container">
            {!user ? (
              <>
                <h2>{authMode === "login" ? "Welcome back" : "Create your account"}</h2>
                <p className="login-subtitle">{authMode === "login" ? "Sign in with your TestManager account" : "Create an administrator workspace account"}</p>
                <form onSubmit={handleAuthentication}>
                  {authMode === "register" && <>
                    <div className="input-group"><label htmlFor="register-name">Full name</label><input id="register-name" type="text" value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} autoComplete="name" minLength={3} required /></div>
                    <div className="input-group"><label htmlFor="register-role">Role</label><select id="register-role" value="Admin" disabled><option value="Admin">Admin</option></select></div>
                  </>}
                  <div className="input-group"><label htmlFor="account-email">Email address</label><input id="account-email" type="email" value={authMode === "login" ? credentials.email : registration.email} onChange={(event) => authMode === "login" ? setCredentials({ ...credentials, email: event.target.value }) : setRegistration({ ...registration, email: event.target.value })} autoComplete="email" placeholder="name@company.com" required /></div>
                  <div className="input-group"><label htmlFor="account-password">{authMode === "login" ? "Password" : "Create password"}</label><input id="account-password" type="password" value={authMode === "login" ? credentials.password : registration.password} onChange={(event) => authMode === "login" ? setCredentials({ ...credentials, password: event.target.value }) : setRegistration({ ...registration, password: event.target.value })} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={authMode === "register" ? 8 : undefined} placeholder={authMode === "register" ? "At least 8 characters" : "Enter your password"} required /></div>
                  {message && <p className={`form-message ${isError ? "error" : "success"}`} role="status">{message}</p>}
                  <button type="submit" className="login-button" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"}</button>
                </form>
                <p className="signup-text">{authMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}<button type="button" className="text-button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setMessage(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p>
                {authMode === "login" && <p className="signup-text invite-reminder">Invited teammates can sign in with the username and temporary password in their email.</p>}
              </>
            ) : user.mustChangePassword ? (
              <>
                <h2>Set a new password</h2>
                <p className="login-subtitle">For your security, replace the temporary password before continuing.</p>
                <form onSubmit={handlePasswordChange}>
                  <div className="input-group"><label htmlFor="current-password">Temporary password</label><input id="current-password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></div>
                  <div className="input-group"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></div>
                  <div className="input-group"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></div>
                  {message && <p className={`form-message ${isError ? "error" : "success"}`} role="status">{message}</p>}
                  <button type="submit" className="login-button" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Change password"}</button>
                </form>
              </>
            ) : (
              <div className="signed-in-panel"><div className="signed-in-icon" aria-hidden="true">✓</div><h2>You're signed in</h2><p className="login-subtitle">Your TestManager workspace is ready.</p><p className="signed-in-email">{user.email}</p><p className="signed-in-role">Role: {user.role}</p><button type="button" className="login-button" onClick={signOut}>Sign out</button></div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
