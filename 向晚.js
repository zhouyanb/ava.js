var compileCommand = {
    getvalue(expr, ava) {
        return expr.split('.').reduce((data, curvalue) => {
            return data[curvalue.replace(/(^\s*)|(\s*$)/g, "")];
        }, ava.data)
    },
    setvalue(expr, ava, input) {
        expr.split('.').reduce((data, curvalue) => {
            var val = data[curvalue.replace(/(^\s*)|(\s*$)/g, "")];
            if (typeof val !== 'object') {
                data[curvalue.replace(/(^\s*)|(\s*$)/g, "")] = input;
            }
            return val;
        }, ava.data)
    },
    getContentVal(value, ava) {
        return value.replace(/\{\{(.+?)\}\}/g, (...args) => {
            return this.getvalue(args[1], ava);
        })
    },
    // 策略模式 执行指令
    text: function (node, value, ava) {
        var content;
        // 处理{{}}
        if (value.indexOf('{{') !== -1) {
            content = value.replace(/\{\{(.+?)\}\}/g, (...args) => {
                new Watcher(ava, args[1], () => {
                    this.updater.textupdate(node, this.getContentVal(value, ava));
                })
                return this.getvalue(args[1].replace(/(^\s*)|(\s*$)/g, ""), ava);
            })
        } else {
            // 处理a-text
            content = this.getvalue(value, ava);
            new Watcher(ava, value, (newVal) => {
                this.updater.textupdate(node, newVal);
            })
        }
        this.updater.textupdate(node, content);
    },
    html: function (node, value, ava) {
        new Watcher(ava, value, (newVal) => {
            this.updater.htmlupdate(node, newVal);
        })
        var content = this.getvalue(node, content);
        this.updater.htmlupdate(node, content);
    },
    model: function (node, value, ava) {
        var content = this.getvalue(value, ava);
        // 数据=>视图
        new Watcher(ava, value, (newVal) => {
            this.updater.modelupdate(node, newVal);
        })
        // 视图=>数据=>视图
        node.addEventListener('input', (e) => {
            this.setvalue(value, ava, e.target.value);
        })
        this.updater.modelupdate(node, content);
    },
    on: function (node, value, ava, event) {
        var method = ava.options.methods[value];
        node.addEventListener(event, method.bind(ava), false);
    },
    bind: function (node, value, ava, attr) {
        var content = this.getvalue(value, ava)
        if (typeof content === 'object') {
            var str = '';
            for (key in content) {
                str = str + key + ':' + content[key] + ';'
            }
            content = str;
        }
        node.setAttribute(attr, content);
    },
    updater: {
        textupdate: function (node, value) {
            node.textContent = value;
        },
        htmlupdate: function (node, value) {
            node.innerHTML = value;
        },
        modelupdate: function (node, value) {
            node.value = value;
        },
    }
}

function Compile(id, ava) {
    this.element = document.getElementById(id);
    this.ava = ava;
    var start_if = false;
    var start_else = false;
    var start_else_if = false;
    var if_content = '';
    var else_if_content = '';
    // 获取文档碎片对象，放入内存中会减少页面的回流重绘
    var fragment = nodeFragment(this.element);
    // 编译模板
    compile(fragment);
    this.element.appendChild(fragment);
    function nodeFragment(element) {
        // 创建文档碎片
        var f = document.createDocumentFragment();
        var firstchild;
        // 遍历获取所有的节点
        while (firstchild = element.firstChild) {
            // 当appendChild添加的是网页中的dom对象
            // 会直接移动节点，也就是会在网页中删除该节点移动到添加的对象中
            // 也就是剪切
            f.appendChild(firstchild);
        }
        return f;
    }
    function compile(fragment) {
        // children是一个类数组
        var children = fragment.childNodes;
        // 遍历子节点
        var childlist = Array.prototype.slice.call(children);
        for (var i = 0; i < childlist.length; i++) {
            if (isNode(childlist[i])) {
                // 是元素节点
                if (start_if && !start_else) {
                    if (start_else_if) {
                        compileif(childlist[i], 'else_if')
                    } else {
                        compileif(childlist[i], 'if')
                    }
                } else if (start_else) {
                    compileif(childlist[i], 'else')
                } else {
                    compileNode(childlist[i])
                    if (childlist[i].childNodes && childlist[i].childNodes.length) {
                        compile(childlist[i])
                    }
                }
            } else {
                // 是文本节点
                compileText(childlist[i]);
            }
        }
    }
    function compileNode(element) {
        var attributes = element.attributes;
        // 强制转换成数组
        [...attributes].forEach(attr => {
            var { name, value } = attr;
            if (name.startsWith('a-')) {
                // 是一个指令
                // var command = name.split('-')[1];
                // 解构赋值 es6
                var [, command] = name.split('-');
                var [commandName, eventName] = command.split(':');
                compileCommand[commandName](element, value, ava, eventName);
                element.removeAttribute('a-' + command);
            } else if (name.startsWith('@')) {
                var [, eventName] = name.split('@');
                compileCommand['on'](element, value, ava, eventName);
                element.removeAttribute('@' + eventName);
            }
        })
    }
    function compileText(element) {
        var content = element.textContent;
        var content = content.replace(/(^\s*)|(\s*$)/g, "");
        select_if(element, content)
        var reg = /\{\{(.+?)\}\}/
        if (reg.test(content)) {
            compileCommand['text'](element, content, ava)
        }
    }
    function select_if(element, content) {
        var re_else = /\}\s*(else)\s*\{/
        var re_else_if = /\}\s*(else)\s*(if\(.+\))\s*\{/
        if (content.startsWith('if')) {
            start_if = true;
            if_content = content;
            element.remove(true)
        }
        if (re_else_if.test(content)) {
            start_else_if = true;
            else_if_content = content;
            element.remove(true)
        }
        if (re_else.test(content)) {
            start_else = true;
            element.remove(true)
        }
        if (content === '}') {
            start_if = false;
            start_else = false;
            start_else_if = false;
            element.remove(true)
        }
    }
    function compileif(element, type) {
        let reg = /\(.+\)/;
        var arg = reg.exec(if_content)[0].replace(/\(/, '').replace(/\)/, '');
        var show = compileCommand.getvalue(arg, ava);
        if (start_else_if) {
            var re = /\}\s*(else)\s*(if\(.+\))\s*\{/
            var _arg = re.exec(else_if_content)[2].replace(/\(/, '').replace(/\)/, '').replace(/if/, '');
        }
        if (type === 'if') {
            new Watcher(ava, arg, (newVal) => {
                if (newVal) {
                    element.style.display = '';
                    compile(element)
                } else {
                    element.style.display = 'none';
                }
            })
        } else if (type === 'else_if') {
            show = compileCommand.getvalue(_arg, ava);
            new Watcher(ava, _arg, (newVal) => {
                if (newVal) {
                    element.style.display = '';
                    compile(element)
                } else {
                    element.style.display = 'none';
                }
            })
        } else if (type === 'else') {
            show = !show
            if (start_else_if) {
                var __arg = _arg;
            } else {
                var __arg = arg;
            }
            new Watcher(ava, __arg, (newVal) => {
                if (!newVal) {
                    element.style.display = '';
                    compile(element);
                } else {
                    element.style.display = 'none';
                }
            })
        }
        if (!show) {
            element.style.display = "none";
        } else {
            compile(element)
        }
    }
    function isNode(element) {
        return element.nodeType === 1;
    }
}


function Watcher(ava, value, cbFn) {
    this.ava = ava;
    this.value = value;
    this.cbFn = cbFn;
    this.oldVal = this.getoldVal();
}

Watcher.prototype.getoldVal = function () {
    Dep.target = this;
    var oldval = compileCommand.getvalue(this.value, this.ava);
    Dep.target = null;
    return oldval;
}

Watcher.prototype.update = function () {
    var newVal = compileCommand.getvalue(this.value, this.ava);
    if (newVal !== this.oldVal) {
        this.cbFn(newVal)
    }
    this.oldVal = newVal;
}

function Dep() {
    this.deps = [];
}

// 收集观察者
Dep.prototype.addWatcher = function (watcher) {
    this.deps.push(watcher);
}

// 通知观察者更新
Dep.prototype.notify = function () {
    console.log(this.deps)
    this.deps.forEach((w) => w.update())
}

function Observer(data) {
    this.data = data;
    observer(data);
    function observer(data) {
        if (data && typeof data === 'object') {
            Object.keys(data).forEach((key) => {
                defineReactive(data, key, data[key]);
            })
        }
    }
    function defineReactive(data, key, value) {
        observer(value);
        var dep = new Dep();
        // 数据劫持
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: false,
            get: function () {
                // console.log('get')
                // 订阅数据变化
                Dep.target && dep.addWatcher(Dep.target);
                return value;
            },
            set: function (newVal) {
                if (value !== newVal) {
                    // console.log('set')
                    observer(newVal);
                    value = newVal;
                    dep.notify();
                }
            }
        })
    }
}

function ava(obj) {
    this.id = obj.id;
    this.data = obj.data;
    this.options = obj;
    if (this.id) {
        // 数据观察,绑定数据访问属性
        new Observer(this.data);
        // 编译模板
        new Compile(this.id, this);
        // 用this来代理this.data
        this.proxyData(this.data);
    }
}

ava.prototype.proxyData = function (data) {
    // 不能使用var声明,只能用const
    // const的声明会存在作用域 在for外key已失效
    for (const key in data) {
        // defineProperty中的可以可以是不存在的
        // 如果不存在则会创建
        // 如果存在则根据configurable的值来判断属性是否可以改变或删除,可以防止属性重新定义
        Object.defineProperty(this, key, {
            get: function () {
                return data[key];
            },
            set: function (newVal) {
                data[key] = newVal;
            }
        })
    }
}