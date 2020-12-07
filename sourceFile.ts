// Mock all of the posible code it might contain.
function a() { }

let b = {};
b.prototype.foo = function () { }

let c = {};
c['foo'] = function () { };

const d = {
    foo: function () { }
};

let e = function (cb) { }
e(function () { });

let f = {};
/* Some trivia we don't want to show. */
f.prototype.foo = function () { }

let g = function (cb) { }
g(function foo() { })

let h = function () { }