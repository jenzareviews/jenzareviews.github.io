import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = "https://yfvshmfkyxcwgyhfhqms.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdnNobWZreXhjd2d5aGZocW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTc5NzIsImV4cCI6MjA4NDA5Mzk3Mn0.jMSSyu1ISa1dArbASM9szweWyZONpM1z1XfPHHr6eMc";
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const forgotBtn = document.getElementById("forgotPassword");
const successMsg = document.getElementById("successMsg");


loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorMsg.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

const { data, error } = await supabaseClient.auth.signInWithPassword({
  email,
  password
});

if (error) {
  if (error.message.toLowerCase().includes("not confirmed")) {
    errorMsg.textContent =
      "Please verify your email before logging in.";
  } else {
    errorMsg.textContent = error.message;
  }
  return;
}

// ✅ logged in & verified
window.location.href = "/professors.html";

});

forgotBtn.addEventListener("click", async () => {
  errorMsg.textContent = "";
  successMsg.textContent = "";

  const email = document.getElementById("email").value.trim();

  if (!email) {
    errorMsg.textContent = "Please enter your email to reset your password.";
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/passreset.html"
  });

  if (error) {
    errorMsg.textContent = error.message;
  } else {
    successMsg.textContent = "Password reset email sent. Check your inbox.";
  }
});
