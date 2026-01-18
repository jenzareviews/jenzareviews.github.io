import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = "https://yfvshmfkyxcwgyhfhqms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdnNobWZreXhjd2d5aGZocW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTc5NzIsImV4cCI6MjA4NDA5Mzk3Mn0.jMSSyu1ISa1dArbASM9szweWyZONpM1z1XfPHHr6eMc";

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

const registerForm = document.getElementById("registerForm");
const errorMsg = document.getElementById("errorMsg");
const successMsg = document.getElementById("successMsg");
const resendBtn = document.getElementById("resendEmail");


registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorMsg.textContent = "";
  successMsg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  // Only allow university email
  if (!email.endsWith("@edu.aua.am")) {
    errorMsg.textContent = "Please use your university email (@edu.aua.am).";
    return;
  }

  // Check passwords match
  if (password !== confirmPassword) {
    errorMsg.textContent = "Passwords do not match.";
    return;
  }

  // Minimum password length (optional)
  if (password.length < 6) {
    errorMsg.textContent = "Password must be at least 6 characters.";
    return;
  }

  // Register user
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin + "/login.html"
    }
  });

  if (error) {
    errorMsg.textContent = error.message;
  return;
}

// 🚨 user already exists (Supabase quirk)
  if (data.user && data.user.identities.length === 0) {
    errorMsg.textContent = "An account with this email already exists. Please log in instead.";
  return;
}

// ✅ new user
successMsg.textContent = "Registration successful! Check your email to verify your account.";
registerForm.reset();

});
resendBtn.addEventListener("click", async () => {
  errorMsg.textContent = "";
  successMsg.textContent = "";

  const email = document.getElementById("email").value.trim();

  if (!email) {
    errorMsg.textContent = "Please enter your email first.";
    return;
  }

  if (!email.endsWith("@edu.aua.am")) {
    errorMsg.textContent = "Please use your university email (@edu.aua.am).";
    return;
  }

  const { error } = await supabaseClient.auth.resend({
    type: "signup",
    email
  });

  if (error) {
    errorMsg.textContent = error.message;
  } else {
    successMsg.textContent =
      "Verification email resent. Check your inbox or spam folder.";
  }
});


