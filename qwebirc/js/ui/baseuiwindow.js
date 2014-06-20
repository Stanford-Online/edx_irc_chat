qwebirc.ui.HILIGHT_NONE = 0;
qwebirc.ui.HILIGHT_ACTIVITY = 1;
qwebirc.ui.HILIGHT_SPEECH = 2;
qwebirc.ui.HILIGHT_US = 3;

qwebirc.ui.MAXIMUM_LINES_PER_WINDOW = 1000;

qwebirc.ui.WINDOW_LASTLINE = qwebirc.ui.WINDOW_QUERY | qwebirc.ui.WINDOW_MESSAGES | qwebirc.ui.WINDOW_CHANNEL | qwebirc.ui.WINDOW_STATUS;

qwebirc.ui.Window = new Class({
  Implements: [Events],
  initialize: function(parentObject, client, type, name, identifier) {
    this.parentObject = parentObject;
    this.type = type;
    this.name = name;
    this.active = false;
    this.client = client;
    this.identifier = identifier;
    this.hilighted = qwebirc.ui.HILIGHT_NONE;
    this.scrolltimer = null;
    this.commandhistory = this.parentObject.commandhistory;
    this.scrolleddown = true;
    this.scrollpos = null;
    this.lastNickHash = {};
    this.lastSelected = null;
    this.subWindow = null;
    this.closed = false;
    
    // GGG list of allowed FontAwesome icons!
    this.iconsAllowed = ["anchor", "beer", "bell", "bolt", "bomb", "book", "briefcase", "bug", "bullhorn", "camera",
                         "camera-retro", "car", "check", "cloud", "coffee", "comment", "comments", "compass", "cube",
                         "cutlery", "envelope", "fighter-jet", "fire-extinguisher", "flag", "flag-checkered", "flask",
                         "gamepad", "gavel", "gift", "globe", "graduation-cap", "heart", "home", "key", "leaf",
                         "life-ring", "magic", "money", "music", "paper-plane", "paw", "pencil", "plane", "puzzle-piece",
                         "recycle", "road", "rocket", "space-shuttle", "star", "suitcase", "taxi", "thumb-tack",
                         "thumbs-down", "thumbs-up", "ticket", "tree", "trophy", "truck", "umbrella", "wrench"];
    
    if(this.type & qwebirc.ui.WINDOW_LASTLINE) {
      this.lastPositionLine = new Element("hr");
      this.lastPositionLine.addClass("lastpos");
      this.lastPositionLineInserted = false;
    }
  },
  updateTopic: function(topic, element)  {
    qwebirc.ui.Colourise("[" + topic + "]", element, this.client.exec, this.parentObject.urlDispatcher.bind(this.parentObject), this);
  },
  close: function() {
    this.closed = true;
    
    if($defined(this.scrolltimer)) {
      $clear(this.scrolltimer);
      this.scrolltimer = null;
    }

    this.parentObject.__closed(this);
    this.fireEvent("close", this);
  },
  subEvent: function(event) {
    if($defined(this.subWindow))
      this.subWindow.fireEvent(event);
  },
  setSubWindow: function(window) {
    this.subWindow = window;
  },
  select: function() {
    if(this.lastPositionLineInserted && !this.parentObject.uiOptions.LASTPOS_LINE) {
      this.lines.removeChild(this.lastPositionLine);
      this.lastPositionLineInserted = false;
    }
  
    this.active = true;
    this.parentObject.__setActiveWindow(this);
    if(this.hilighted)
      this.setHilighted(qwebirc.ui.HILIGHT_NONE);

    this.subEvent("select");      
    this.resetScrollPos();
    this.lastSelected = new Date();
  },
  deselect: function() {
    this.subEvent("deselect");
    
    this.setScrollPos();
    if($defined(this.scrolltimer)) {
      $clear(this.scrolltimer);
      this.scrolltimer = null;
    }

    if(this.type & qwebirc.ui.WINDOW_LASTLINE)
      this.replaceLastPositionLine();
    
    this.active = false;
  },
  resetScrollPos: function() {
    if(this.scrolleddown) {
      this.scrollToBottom();
    } else if($defined(this.scrollpos)) {
      this.getScrollParent().scrollTo(this.scrollpos.x, this.scrollpos.y);
    }
  },
  setScrollPos: function() {
    if(!this.parentObject.singleWindow) {
      this.scrolleddown = this.scrolledDown();
      this.scrollpos = this.lines.getScroll();
    }
  },
  addLine: function(type, line, colour, element) {
    var hilight = qwebirc.ui.HILIGHT_NONE;
    var lhilight = false;
    date = (line && line.hasOwnProperty('date')) ? new Date(line['date']) : new Date();
    
    if(type) {
      hilight = qwebirc.ui.HILIGHT_ACTIVITY;
      
      if(type.match(/(NOTICE|ACTION|MSG)$/)) {
        if(this.type == qwebirc.ui.WINDOW_QUERY || this.type == qwebirc.ui.WINDOW_MESSAGES) {
          if(type.match(/^OUR/) || type.match(/NOTICE$/)) {
            hilight = qwebirc.ui.HILIGHT_ACTIVITY;
          } else {
            hilight = qwebirc.ui.HILIGHT_US;
            this.parentObject.beep();
            this.parentObject.flash();
          }
        }
        if(!type.match(/^OUR/) && this.client.hilightController.match(line["m"])) {
          lhilight = true;
          hilight = qwebirc.ui.HILIGHT_US;
          this.parentObject.beep();
          this.parentObject.flash();
        } else if(hilight != qwebirc.ui.HILIGHT_US) {
          hilight = qwebirc.ui.HILIGHT_SPEECH;
        }
      }
    }

    if(!this.active && (hilight != qwebirc.ui.HILIGHT_NONE))
      this.setHilighted(hilight);

    if(type)
      line = this.parentObject.theme.message(type, line, lhilight);
    
    var tsE = document.createElement("span");
    tsE.className = "timestamp";
    tsE.appendChild(document.createTextNode(qwebirc.irc.IRCTimestamp(date) + " "));
    element.appendChild(tsE);
    
    qwebirc.ui.Colourise(line, element, this.client.exec, this.parentObject.urlDispatcher.bind(this.parentObject), this);
    
    if (element.hasClass('msg-icon')) {
      var opUser = element.childNodes[1].childNodes[1];
      var space = document.createTextNode(" ");
      opUser.insertBefore(space, opUser.firstChild);
      var icon = document.createElement("i");
      
      if (element.hasClass('prof-msg')) { //   GGG see if message is op, then add op icon.
        icon.className = "fa fa-graduation-cap";
      } else if (element.hasClass('join-msg') || element.hasClass('op-msg')) {
        icon.className = "fa fa-tree";
      }
      
      opUser.insertBefore(icon, opUser.firstChild);
    }
    
    // GGG icons from list at top of file replace with FontAwesome icons!
    var icons = element.innerHTML.match(/:[a-z]*-*[a-z]*:/g);
    if (icons !== null) {
      for (var i=0; i<icons.length; i++) {
        var iconReplace = icons[i]
        var icon = iconReplace.substring(1, iconReplace.length-1);
        
        if (this.iconsAllowed.indexOf(icon) >= 0) {
          var iconElem = document.createElement("i");
          var iconClass = "fa fa-" + icon;
          iconElem.className = iconClass;
          
          var elemContainer = document.createElement("div");
          elemContainer.appendChild(iconElem);
          element.innerHTML = element.innerHTML.replace(iconReplace, elemContainer.innerHTML)
        }
      }
    }
    // end message icon replacement
    
    this.scrollAdd(element);
  },
  errorMessage: function(message) {
    this.addLine("", message, "warncolour");
  },
  infoMessage: function(message) {
    this.addLine("", message, "infocolour");
  },
  setHilighted: function(state) {
    if(state == qwebirc.ui.HILIGHT_NONE || state >= this.hilighted)
      this.hilighted = state;
  },
  scrolledDown: function() {
    if(this.scrolltimer)
      return true;
      
    var parent = this.lines;
    
    var prev = parent.getScroll();
    var prevbottom = parent.getScrollSize().y;
    var prevheight = parent.clientHeight;

    /*
     * fixes an IE bug: the scrollheight is less than the actual height
     * when the div isn't full
     */
    if(prevbottom < prevheight)
      prevbottom = prevheight;
      
    return prev.y + prevheight == prevbottom;
  },
  getScrollParent: function() {
    var scrollparent = this.lines;

    if($defined(this.scroller))
      scrollparent = this.scroller;
    return scrollparent;
  },
  scrollToBottom: function() {
    if(this.type == qwebirc.ui.WINDOW_CUSTOM || this.type == qwebirc.ui.WINDOW_CONNECT)
      return;

    var parent = this.lines;
    var scrollparent = this.getScrollParent();
      
    scrollparent.scrollTo(parent.getScroll().x, parent.getScrollSize().y);
  },
  scrollAdd: function(element) {
    var parent = this.lines;
    var oldBottomOffset = parent.scrollHeight - parent.clientHeight - parent.scrollTop;
    var reading = oldBottomOffset > (parent.clientHeight/2);
    
    /* scroll in bursts, else the browser gets really slow */
    if($defined(element)) {
      var sd = this.scrolledDown();
      parent.appendChild(element);
      
      if(parent.childNodes.length > qwebirc.ui.MAXIMUM_LINES_PER_WINDOW)
        parent.removeChild(parent.firstChild);
      if(sd) {
        if(this.scrolltimer)
          $clear(this.scrolltimer);
        this.scrolltimer = this.scrollAdd.delay(50, this, [null]);
      } else {
        if (!reading) {
          this.scrollToBottom();
          reading = false;
          this.scrolltimer = null;
        }
      }
    } else {
      if (!reading) {
        this.scrollToBottom();
        reading = false;
        this.scrolltimer = null;
      }
    }
  },
  updateNickList: function(nicks) {
    var nickHash = {}, present = {};
    var added = [];
    var lnh = this.lastNickHash;
    
    for(var i=0;i<nicks.length;i++)
      present[nicks[i]] = 1;
    
    for(var k in lnh)
      if(!present[k])
        this.nickListRemove(k, lnh[k]);
        
    for(var i=0;i<nicks.length;i++) {
      var n = nicks[i];
      var l = lnh[n];
      if(!l) {
        l = this.nickListAdd(n, i);
        if(!l)
          l = 1;
      }
      nickHash[n] = l;
    }
    
    this.lastNickHash = nickHash;
  },
  nickListAdd: function(position, nick) {
  },
  nickListRemove: function(nick, stored) {
  },
  historyExec: function(line) {
    this.commandhistory.addLine(line);
    this.client.exec(line);
  },
  focusChange: function(newValue) {
    if(newValue == true || !(this.type & qwebirc.ui.WINDOW_LASTLINE))
      return;
    
    this.replaceLastPositionLine();
  },
  replaceLastPositionLine: function() {
    if(this.parentObject.uiOptions.LASTPOS_LINE) {
      if(!this.lastPositionLineInserted) {
        this.scrollAdd(this.lastPositionLine);
      } else if(this.lines.lastChild != this.lastPositionLine) {
        try {
          this.lines.removeChild(this.lastPositionLine);
        } catch(e) {
          /* IGNORE, /clear removes lastPositionLine from the dom without resetting it. */
        }
        this.scrollAdd(this.lastPositionLine);
      }
    } else {
      if(this.lastPositionLineInserted)
        this.lines.removeChild(this.lastPositionLine);
    }
    
    this.lastPositionLineInserted = this.parentObject.uiOptions.LASTPOS_LINE;
  },
  rename: function(name) {
  }
});
