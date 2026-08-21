document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("login-form");
  var errorEl = document.getElementById("login-error");
  var submitBtn = document.getElementById("login-submit");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorEl.classList.remove("is-visible");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        username: document.getElementById("username").value,
        password: document.getElementById("password").value
      })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || "Sign in failed.");
        window.location.href = "dashboard.html";
      })
      .catch(function (err) {
        errorEl.textContent = err.message;
        errorEl.classList.add("is-visible");
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
      });
  });
});
