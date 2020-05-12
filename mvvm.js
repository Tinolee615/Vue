//观察者（发布订阅）
class Dep{
    constructor(){
        this.subs = []; //存放所有的watcher
    }
    //订阅
    addSub(watcher){ // 添加watcher
        this.subs.push(watcher)
    }
    //发布
    notify(){
        this.subs.forEach(watcher => watcher.update())
    }
}
class Watcher{
    constructor(vm,expr,cb){
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        //默认先存放旧的值；
        this.oldVal = this.get()
    }
    get(){
        Dep.target = this;
        //获取vm.$data的值，触发Object.defineProperty注册的get方法
        let value = CompileUtil.getVal(this.vm,this.expr);
        Dep.target = null;
        return value
    }
    update(){ //数据变化后，调用观察者的update方法
        let newVal = CompileUtil.getVal(this.vm,this.expr);
        if(this.oldVal != newVal){
            this.cb(newVal);
        }
    }
}
// vm.$watch(vm,'school.name',(newVal)=>{})

//数据劫持
class Observer{
    constructor(data){
        this.observer(data)
    }
    observer(data){
        if(data && typeof data == 'object'){
            //如果是对象，循环每一项
            for(let key in data){
                this.defineReactive(data,key,data[key]);
            }
        }
    }
    defineReactive(data,key,value){
        this.observer(value)
        let dep = new Dep(); //给每个属性都加上一个具有发布订阅的功能
        Object.defineProperty(data,key,{
            get(){
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set:(newVal)=>{
                if(value == newVal) return;
                this.observer(newVal);
                value= newVal;
                dep.notify();
            }
        })
    }
}

//编译器
class Compiler{
    constructor(el,vm){
        //判断el属性是否是一个元素
        this.el = this.isElementNode(el)?el:document.querySelector(el);

        this.vm = vm;
        //把当前节点中的元素获取放到内存中
        let fragment = this.node2fragment(this.el);

        //把节点中的内容替换

        //编译模板，用数据编译
        this.compile(fragment);

        //把内容塞到页面中
        this.el.appendChild(fragment);
    }
    isDirective(attrName){
        return attrName.startsWith('v-');
    }
    //编译元素
    compileElement(node){
        let attributes = node.attributes; // 类数组
        
        [...attributes].forEach(attr => {
            let {name,value:expr} = attr;
            //判断是否是指令
            if(this.isDirective(name)){
                let [,directive] = name.split('-')
                let [directiveName,eventName] = directive.split(':')
                //调用不同的指令处理函数
                CompileUtil[directiveName](node,expr,this.vm,eventName);
            }
        })
    }
    //编译文本
    compileText(node){ //判断当前文本节点中分内容
        let reg = /\{\{(.*?)\}\}/;
        let content = node.textContent;
        if(reg.test(content)){
            //文本节点
            CompileUtil['text'](node,content,this.vm);
        }
    }
    //核心的编译方法
    compile(node){
        let childNodes = node.childNodes;
        [...childNodes].forEach(child => {
            if(this.isElementNode(child)){
                //是元素
                this.compileElement(child);
                //如果是元素，需要遍历子节点
                this.compile(child);
            }else{
                //是文本
                this.compileText(child)
            }
        })
    }
    node2fragment(node){
        //创建文档碎片
        let fragment = document.createDocumentFragment();
        let firstChild;
        while(firstChild = node.firstChild){
            fragment.appendChild(firstChild)
        }
        return fragment;
    }
    //判断是否是元素节点
    isElementNode(node){
        return node.nodeType === 1;
    }
}
CompileUtil = {
    //获取表达式对应的data值
    getVal(vm,expr){
        return expr.split('.').reduce((data,current)=>{
            return data[current];
        },vm.$data);
    },
    setVal(vm,expr,value){
        expr.split('.').reduce((data,current,index,arr) =>{
            if(arr.length-1 == index){
                return data[current] = value;
            }
            return data[current];
        },vm.$data);
    },
    //解析v-model指令
    model(node,expr,vm){ //node 节点  expr 表达式  vm 当前实例
        //给输入框赋予value属性
        let fn = this.updater['modelUpdater']
        new Watcher(vm,expr,(newVal)=>{ //给输入框加观察者，数据更新时触发
            fn(node,newVal)
        })
        node.addEventListener('input',(e)=>{
            let value  =e.target.value;//获取用户输入的内容
            this.setVal(vm,expr,value)
        })
        let value = this.getVal(vm,expr);
        fn(node,value)
    },
    html(node,expr,vm){
        //node.innerHTML = 'xxx'
        let fn = this.updater['htmlUpdater']
        new Watcher(vm,expr,(newVal)=>{
            fn(node,newVal)
        })
        let value = this.getVal(vm,expr);
        fn(node,value)
    },
    text(node,expr,vm){ // expr  {{a}} {{b}}
        let fn = this.updater['textUpdater']
        let content = expr.replace(/\{\{(.*?)\}\}/g,(...args) => {
            new Watcher(vm,args[1],(newVal)=>{ //给表达式每个{{}}都加加观察者，数据更新时触发
                fn(node,this.getContentVal(vm,expr)) //返回一个全的字符串
            })
            return this.getVal(vm,args[1]);
        })
        fn(node,content);
    },
    on(node,expr,vm,event){ //expr  v-on:click="change"
        node.addEventListener(event,(e)=>{
            vm[expr].call(vm,e)
        })
    },
    getContentVal(vm,expr){
        //遍历表达式，将内容重新替换成一个完整的内容，返还回去
        return expr.replace(/\{\{(.*?)\}\}/g,(...args)=>{
            console.log(args)
            return this.getVal(vm,args[1]);
        })
    },
    updater:{
        //把数据插入到v-model绑定节点中
        modelUpdater(node,value){
            node.value = value;
        },
        htmlUpdater(node,value){
            node.innerHTML = value;
        },
        textUpdater(node,value){
            node.textContent = value;
        }
    }
}
class Vue{
    constructor(options){
        this.$options = options;
        this.$el = options.el;
        this.$data = options.data;
        let computed = options.computed;
        let methods = options.methods;
        //根元素存在，编译模板
        if(this.$el){
            //把数据全部转化成用Object.defineProperty来定义
            new Observer(this.$data);
            // {{getNewName}}  reduce vm.$data.getNewName
            for(let key in computed){
                Object.defineProperty(this.$data,key,{
                    get:()=>{
                        return computed[key].call(this);
                    }
                })
            }
            for(let key in methods){
                Object.defineProperty(this,key,{
                    get(){
                        return methods[key]
                    }
                })
            }
            //数据获取操作 vm上的取值操作代理到vm.$data;
            this.proxyVm(this.$data)

            //编译器
            new Compiler(this.$el,this)
        }
    }
    proxyVm(data){
        for(let key in data){
            Object.defineProperty(this,key,{
                get(){
                    return data[key];//代理
                },
                set(newVal){ //设置代理方法
                    data[key] = newVal;
                }
            })
        }
    }
}
