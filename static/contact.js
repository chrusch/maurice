/* The contact form: fill in the page a reader came from, and send the
   message to Web3Forms without leaving the page. Without JavaScript the form
   still posts, and Web3Forms redirects back to contact.html#sent. */
(function () {
  "use strict";
  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = document.getElementById("contact-status");
  var about = form.elements.about;
  var params = new URLSearchParams(location.search);

  // Arriving from "Report a mistake": the page, and any words the reader selected.
  if (params.get("page")) {
    about.value = "mistake";
    form.elements.page.value = params.get("page");
    form.elements.url.value = params.get("url") || "";
    if (params.get("quote")) form.elements.passage.value = params.get("quote");
  }
  function showFields() {
    form.classList.toggle("is-mistake", about.value === "mistake");
  }
  about.addEventListener("change", showFields);
  showFields();

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var captcha = form.querySelector("textarea[name=h-captcha-response]");
    if (captcha && !captcha.value) {
      status.textContent = "Please tick the box to show you're not a robot.";
      return;
    }
    var label = about.options[about.selectedIndex].text;
    form.elements.subject.value = "fdmaurice.com: " + label +
      (about.value === "mistake" && form.elements.page.value ? " (" + form.elements.page.value + ")" : "");
    var data = Object.fromEntries(new FormData(form));
    delete data.redirect;
    var button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "Sending…";
    fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.success) {
          form.reset();
          showFields();
          form.hidden = true;
          document.getElementById("sent").classList.add("is-shown");
          status.textContent = "";
        } else {
          status.textContent = "Sorry, the message could not be sent: " +
            ((json.body && json.body.message) || json.message || "unknown error") + ".";
        }
      })
      .catch(function () {
        status.textContent = "Sorry, the message could not be sent. Please check your connection and try again.";
      })
      .finally(function () {
        button.disabled = false;
        if (window.hcaptcha) { try { window.hcaptcha.reset(); } catch (e) {} }
      });
  });
})();
