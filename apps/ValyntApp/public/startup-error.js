window.onerror = function (msg, url, line, col, error) {
  var fallback = document.getElementById("loading-fallback");
  if (fallback) {
    fallback.textContent = "";
    var container = document.createElement("div");
    container.style.cssText = "color:red;padding:20px;max-width:600px;";
    var title = document.createElement("h2");
    title.textContent = "Startup Error";
    container.appendChild(title);
    var msgP = document.createElement("p");
    msgP.textContent = msg;
    container.appendChild(msgP);
    var fileP = document.createElement("p");
    fileP.textContent = "File: " + url + ":" + line;
    container.appendChild(fileP);
    fallback.appendChild(container);
  }
  return false;
};
