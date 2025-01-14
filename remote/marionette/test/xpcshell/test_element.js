/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const {
  element,
  WebElement,
  WebFrame,
  WebReference,
  WebWindow,
} = ChromeUtils.importESModule(
  "chrome://remote/content/marionette/element.sys.mjs"
);

class Element {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName;
    this.localName = tagName;

    for (let attr in attrs) {
      this[attr] = attrs[attr];
    }
  }

  get nodeType() {
    return 1;
  }
  get ELEMENT_NODE() {
    return 1;
  }

  // this is a severely limited CSS selector
  // that only supports lists of tag names
  matches(selector) {
    let tags = selector.split(",");
    return tags.includes(this.localName);
  }
}

class DOMElement extends Element {
  constructor(tagName, attrs = {}) {
    super(tagName, attrs);

    if (typeof this.namespaceURI == "undefined") {
      this.namespaceURI = XHTML_NS;
    }
    if (typeof this.ownerDocument == "undefined") {
      this.ownerDocument = { designMode: "off" };
    }
    if (typeof this.ownerDocument.documentElement == "undefined") {
      this.ownerDocument.documentElement = { namespaceURI: XHTML_NS };
    }

    if (typeof this.type == "undefined") {
      this.type = "text";
    }

    if (this.localName == "option") {
      this.selected = false;
    }

    if (
      this.localName == "input" &&
      ["checkbox", "radio"].includes(this.type)
    ) {
      this.checked = false;
    }
  }

  getBoundingClientRect() {
    return {
      top: 0,
      left: 0,
      width: 100,
      height: 100,
    };
  }
}

class SVGElement extends Element {
  constructor(tagName, attrs = {}) {
    super(tagName, attrs);
    this.namespaceURI = SVG_NS;
  }
}

class XULElement extends Element {
  constructor(tagName, attrs = {}) {
    super(tagName, attrs);
    this.namespaceURI = XUL_NS;

    if (typeof this.ownerDocument == "undefined") {
      this.ownerDocument = {};
    }
    if (typeof this.ownerDocument.documentElement == "undefined") {
      this.ownerDocument.documentElement = { namespaceURI: XUL_NS };
    }
  }
}

const domEl = new DOMElement("p");
const svgEl = new SVGElement("rect");
const xulEl = new XULElement("text");

const domElInPrivilegedDocument = new Element("input", {
  nodePrincipal: { isSystemPrincipal: true },
});
const xulElInPrivilegedDocument = new XULElement("text", {
  nodePrincipal: { isSystemPrincipal: true },
});

class WindowProxy {
  get parent() {
    return this;
  }
  get self() {
    return this;
  }
  toString() {
    return "[object Window]";
  }
}
const domWin = new WindowProxy();
const domFrame = new (class extends WindowProxy {
  get parent() {
    return domWin;
  }
})();

add_test(function test_findClosest() {
  equal(element.findClosest(domEl, "foo"), null);

  let foo = new DOMElement("foo");
  let bar = new DOMElement("bar");
  bar.parentNode = foo;
  equal(element.findClosest(bar, "foo"), foo);

  run_next_test();
});

add_test(function test_isSelected() {
  let checkbox = new DOMElement("input", { type: "checkbox" });
  ok(!element.isSelected(checkbox));
  checkbox.checked = true;
  ok(element.isSelected(checkbox));

  // selected is not a property of <input type=checkbox>
  checkbox.selected = true;
  checkbox.checked = false;
  ok(!element.isSelected(checkbox));

  let option = new DOMElement("option");
  ok(!element.isSelected(option));
  option.selected = true;
  ok(element.isSelected(option));

  // checked is not a property of <option>
  option.checked = true;
  option.selected = false;
  ok(!element.isSelected(option));

  // anything else should not be selected
  for (let typ of [domEl, undefined, null, "foo", true, [], {}]) {
    ok(!element.isSelected(typ));
  }

  run_next_test();
});

add_test(function test_isElement() {
  ok(element.isElement(domEl));
  ok(element.isElement(svgEl));
  ok(element.isElement(xulEl));
  ok(!element.isElement(domWin));
  ok(!element.isElement(domFrame));
  for (let typ of [true, 42, {}, [], undefined, null]) {
    ok(!element.isElement(typ));
  }

  run_next_test();
});

add_test(function test_isDOMElement() {
  ok(element.isDOMElement(domEl));
  ok(element.isDOMElement(domElInPrivilegedDocument));
  ok(element.isDOMElement(svgEl));
  ok(!element.isDOMElement(xulEl));
  ok(!element.isDOMElement(xulElInPrivilegedDocument));
  ok(!element.isDOMElement(domWin));
  ok(!element.isDOMElement(domFrame));
  for (let typ of [true, 42, {}, [], undefined, null]) {
    ok(!element.isDOMElement(typ));
  }

  run_next_test();
});

add_test(function test_isXULElement() {
  ok(element.isXULElement(xulEl));
  ok(element.isXULElement(xulElInPrivilegedDocument));
  ok(!element.isXULElement(domElInPrivilegedDocument));
  ok(!element.isXULElement(domEl));
  ok(!element.isXULElement(svgEl));
  ok(!element.isXULElement(domWin));
  ok(!element.isXULElement(domFrame));
  for (let typ of [true, 42, {}, [], undefined, null]) {
    ok(!element.isXULElement(typ));
  }

  run_next_test();
});

add_test(function test_isDOMWindow() {
  ok(element.isDOMWindow(domWin));
  ok(element.isDOMWindow(domFrame));
  ok(!element.isDOMWindow(domEl));
  ok(!element.isDOMWindow(domElInPrivilegedDocument));
  ok(!element.isDOMWindow(svgEl));
  ok(!element.isDOMWindow(xulEl));
  for (let typ of [true, 42, {}, [], undefined, null]) {
    ok(!element.isDOMWindow(typ));
  }

  run_next_test();
});

add_test(function test_isReadOnly() {
  ok(!element.isReadOnly(null));
  ok(!element.isReadOnly(domEl));
  ok(!element.isReadOnly(new DOMElement("p", { readOnly: true })));
  ok(element.isReadOnly(new DOMElement("input", { readOnly: true })));
  ok(element.isReadOnly(new DOMElement("textarea", { readOnly: true })));

  run_next_test();
});

add_test(function test_isDisabled() {
  ok(!element.isDisabled(new DOMElement("p")));
  ok(!element.isDisabled(new SVGElement("rect", { disabled: true })));
  ok(!element.isDisabled(new XULElement("browser", { disabled: true })));

  let select = new DOMElement("select", { disabled: true });
  let option = new DOMElement("option");
  option.parentNode = select;
  ok(element.isDisabled(option));

  let optgroup = new DOMElement("optgroup", { disabled: true });
  option.parentNode = optgroup;
  optgroup.parentNode = select;
  select.disabled = false;
  ok(element.isDisabled(option));

  ok(element.isDisabled(new DOMElement("button", { disabled: true })));
  ok(element.isDisabled(new DOMElement("input", { disabled: true })));
  ok(element.isDisabled(new DOMElement("select", { disabled: true })));
  ok(element.isDisabled(new DOMElement("textarea", { disabled: true })));

  run_next_test();
});

add_test(function test_isEditingHost() {
  ok(!element.isEditingHost(null));
  ok(element.isEditingHost(new DOMElement("p", { isContentEditable: true })));
  ok(
    element.isEditingHost(
      new DOMElement("p", { ownerDocument: { designMode: "on" } })
    )
  );

  run_next_test();
});

add_test(function test_isEditable() {
  ok(!element.isEditable(null));
  ok(!element.isEditable(domEl));
  ok(!element.isEditable(new DOMElement("textarea", { readOnly: true })));
  ok(!element.isEditable(new DOMElement("textarea", { disabled: true })));

  for (let type of [
    "checkbox",
    "radio",
    "hidden",
    "submit",
    "button",
    "image",
  ]) {
    ok(!element.isEditable(new DOMElement("input", { type })));
  }
  ok(element.isEditable(new DOMElement("input", { type: "text" })));
  ok(element.isEditable(new DOMElement("input")));

  ok(element.isEditable(new DOMElement("textarea")));
  ok(
    element.isEditable(
      new DOMElement("p", { ownerDocument: { designMode: "on" } })
    )
  );
  ok(element.isEditable(new DOMElement("p", { isContentEditable: true })));

  run_next_test();
});

add_test(function test_isMutableFormControlElement() {
  ok(!element.isMutableFormControl(null));
  ok(
    !element.isMutableFormControl(
      new DOMElement("textarea", { readOnly: true })
    )
  );
  ok(
    !element.isMutableFormControl(
      new DOMElement("textarea", { disabled: true })
    )
  );

  const mutableStates = new Set([
    "color",
    "date",
    "datetime-local",
    "email",
    "file",
    "month",
    "number",
    "password",
    "range",
    "search",
    "tel",
    "text",
    "url",
    "week",
  ]);
  for (let type of mutableStates) {
    ok(element.isMutableFormControl(new DOMElement("input", { type })));
  }
  ok(element.isMutableFormControl(new DOMElement("textarea")));

  ok(
    !element.isMutableFormControl(new DOMElement("input", { type: "hidden" }))
  );
  ok(!element.isMutableFormControl(new DOMElement("p")));
  ok(
    !element.isMutableFormControl(
      new DOMElement("p", { isContentEditable: true })
    )
  );
  ok(
    !element.isMutableFormControl(
      new DOMElement("p", { ownerDocument: { designMode: "on" } })
    )
  );

  run_next_test();
});

add_test(function test_coordinates() {
  let p = element.coordinates(domEl);
  ok(p.hasOwnProperty("x"));
  ok(p.hasOwnProperty("y"));
  equal("number", typeof p.x);
  equal("number", typeof p.y);

  deepEqual({ x: 50, y: 50 }, element.coordinates(domEl));
  deepEqual({ x: 10, y: 10 }, element.coordinates(domEl, 10, 10));
  deepEqual({ x: -5, y: -5 }, element.coordinates(domEl, -5, -5));

  Assert.throws(() => element.coordinates(null), /node is null/);

  Assert.throws(
    () => element.coordinates(domEl, "string", undefined),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, undefined, "string"),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, "string", "string"),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, {}, undefined),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, undefined, {}),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, {}, {}),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, [], undefined),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, undefined, []),
    /Offset must be a number/
  );
  Assert.throws(
    () => element.coordinates(domEl, [], []),
    /Offset must be a number/
  );

  run_next_test();
});

add_test(function test_WebReference_ctor() {
  let el = new WebReference("foo");
  equal(el.uuid, "foo");

  for (let t of [42, true, [], {}, null, undefined]) {
    Assert.throws(() => new WebReference(t), /to be a string/);
  }

  run_next_test();
});

add_test(function test_WebElemenet_is() {
  let a = new WebReference("a");
  let b = new WebReference("b");

  ok(a.is(a));
  ok(b.is(b));
  ok(!a.is(b));
  ok(!b.is(a));

  ok(!a.is({}));

  run_next_test();
});

add_test(function test_WebReference_from() {
  ok(WebReference.from(domEl) instanceof WebElement);
  ok(WebReference.from(xulEl) instanceof WebElement);
  ok(WebReference.from(domWin) instanceof WebWindow);
  ok(WebReference.from(domFrame) instanceof WebFrame);
  ok(WebReference.from(domElInPrivilegedDocument) instanceof WebElement);
  ok(WebReference.from(xulElInPrivilegedDocument) instanceof WebElement);

  Assert.throws(() => WebReference.from({}), /InvalidArgumentError/);

  run_next_test();
});

add_test(function test_WebReference_fromJSON_WebElement() {
  const { Identifier } = WebElement;

  let ref = { [Identifier]: "foo" };
  let webEl = WebReference.fromJSON(ref);
  ok(webEl instanceof WebElement);
  equal(webEl.uuid, "foo");

  let identifierPrecedence = {
    [Identifier]: "identifier-uuid",
  };
  let precedenceEl = WebReference.fromJSON(identifierPrecedence);
  ok(precedenceEl instanceof WebElement);
  equal(precedenceEl.uuid, "identifier-uuid");

  run_next_test();
});

add_test(function test_WebReference_fromJSON_WebWindow() {
  let ref = { [WebWindow.Identifier]: "foo" };
  let win = WebReference.fromJSON(ref);
  ok(win instanceof WebWindow);
  equal(win.uuid, "foo");

  run_next_test();
});

add_test(function test_WebReference_fromJSON_WebFrame() {
  let ref = { [WebFrame.Identifier]: "foo" };
  let frame = WebReference.fromJSON(ref);
  ok(frame instanceof WebFrame);
  equal(frame.uuid, "foo");

  run_next_test();
});

add_test(function test_WebReference_fromJSON_malformed() {
  Assert.throws(() => WebReference.fromJSON({}), /InvalidArgumentError/);
  Assert.throws(() => WebReference.fromJSON(null), /InvalidArgumentError/);
  run_next_test();
});

add_test(function test_WebReference_fromUUID() {
  let domWebEl = WebReference.fromUUID("bar");
  ok(domWebEl instanceof WebElement);
  equal(domWebEl.uuid, "bar");

  run_next_test();
});

add_test(function test_WebReference_isReference() {
  for (let t of [42, true, "foo", [], {}]) {
    ok(!WebReference.isReference(t));
  }

  ok(WebReference.isReference({ [WebElement.Identifier]: "foo" }));
  ok(WebReference.isReference({ [WebWindow.Identifier]: "foo" }));
  ok(WebReference.isReference({ [WebFrame.Identifier]: "foo" }));

  run_next_test();
});

add_test(function test_generateUUID() {
  equal(typeof element.generateUUID(), "string");
  run_next_test();
});

add_test(function test_WebElement_toJSON() {
  const { Identifier } = WebElement;

  let el = new WebElement("foo");
  let json = el.toJSON();

  ok(Identifier in json);
  equal(json[Identifier], "foo");

  run_next_test();
});

add_test(function test_WebElement_fromJSON() {
  const { Identifier } = WebElement;

  let el = WebElement.fromJSON({ [Identifier]: "foo" });
  ok(el instanceof WebElement);
  equal(el.uuid, "foo");

  Assert.throws(() => WebElement.fromJSON({}), /InvalidArgumentError/);

  run_next_test();
});

add_test(function test_WebWindow_toJSON() {
  let win = new WebWindow("foo");
  let json = win.toJSON();
  ok(WebWindow.Identifier in json);
  equal(json[WebWindow.Identifier], "foo");

  run_next_test();
});

add_test(function test_WebWindow_fromJSON() {
  let ref = { [WebWindow.Identifier]: "foo" };
  let win = WebWindow.fromJSON(ref);
  ok(win instanceof WebWindow);
  equal(win.uuid, "foo");

  run_next_test();
});

add_test(function test_WebFrame_toJSON() {
  let frame = new WebFrame("foo");
  let json = frame.toJSON();
  ok(WebFrame.Identifier in json);
  equal(json[WebFrame.Identifier], "foo");

  run_next_test();
});

add_test(function test_WebFrame_fromJSON() {
  let ref = { [WebFrame.Identifier]: "foo" };
  let win = WebFrame.fromJSON(ref);
  ok(win instanceof WebFrame);
  equal(win.uuid, "foo");

  run_next_test();
});
