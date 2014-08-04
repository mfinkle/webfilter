const { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let debug = Cu.import("resource://gre/modules/AndroidLog.jsm", {}).AndroidLog.d.bind(null, "WebFilter");

var BlockList = [
  { key: "spec", value: "http://crazytown.com/badpart/" },
  { key: "host", value: "justplainevil.com" }
];

var HttpObserver = {
  observe: function (aSubject, aTopic, aData) {
    debug("got a request");
    if (aTopic == "http-on-modify-request") {
      let channel = aSubject.QueryInterface(Ci.nsIHttpChannel);
      if (!channel) {
        debug("has no channel");
        return;
      }

      // Let's only check document (main and iframes) loads
      if (!(channel.loadFlags & channel.LOAD_DOCUMENT_URI)) {
        debug("not a document load");
        debug("URL: " + channel.URI.spec);
        return;
      }

      debug("test URL: " + channel.URI.spec);

      let allow = this.shouldAllow(channel.URI);
      if (!allow) {
        debug("not allowing this URL: " + channel.URI.spec);

        // Using the chrome://webfilter/content/its-not-safe.html page leads to Security Errors from loading a file:// from a http:// page
        // so just use a http:// page for the redirect for now.
        let redirectURI = Services.io.newURI("http://people.mozilla.com/~mfinkle/webfilter/its-not-safe.html", null, null);
        channel.redirectTo(redirectURI);
      }
    }
  },

  shouldAllow: function(aURI) {
    let result = BlockList.every(function(aRule){
      if (aURI[aRule.key] == aRule.value)
        return false;
      return true;
    });
    return result;
  },

  getTabForChannel: function(aChannel) {
    let interfaceRequestor = aChannel.notificationCallbacks.QueryInterface(Ci.nsIInterfaceRequestor);
    let loadContext = null;
    try {
      loadContext = interfaceRequestor.getInterface(Ci.nsILoadContext);
    } catch (ex) {
      loadContext = null;
    }

    if (loadContext) {
      let contentWindow = loadContext.associatedWindow; // DOM content window assoicated with the request (could be an iframe)
      let chromeWindow = contentWindow.top.QueryInterface(Ci.nsIInterfaceRequestor)
                                          .getInterface(Ci.nsIWebNavigation)
                                          .QueryInterface(Ci.nsIDocShellTreeItem)
                                          .rootTreeItem.QueryInterface(Ci.nsIInterfaceRequestor)
                                          .getInterface(Ci.nsIDOMWindow);
      if (chromeWindow) {
        let tab = chromeWindow.BrowserApp.getTabForWindow(contentWindow.top);
        return tab;
      }
    }

    // This channel has no window/tab
    return null;
  }
};

/**
* Handle the add-on being activated on install/enable
*/
function startup(data, reason) {
  Services.obs.addObserver(HttpObserver, "http-on-modify-request", false);
}

/**
* Handle the add-on being deactivated on uninstall/disable
*/
function shutdown(data, reason) {
  Services.obs.removeObserver(HttpObserver, "http-on-modify-request");
}

/**
* Handle the add-on being installed
*/
function install(data, reason) {}

/**
* Handle the add-on being uninstalled
*/
function uninstall(data, reason) {}
