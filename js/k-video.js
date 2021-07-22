// @language_out ES6
/* 2021, dev mail bigandrez@gmail.com, license type has not been selected yet */

class CKVideo extends HTMLVideoElement{
    static get observedAttributes() {
        return ['src']; 
    }
    constructor() {
        super();
        this.kv_event_timeupdate = new Event('timeupdate',{cancelable: false, bubbles: true});
        this.kv_event_ended = document.createEvent('Event');
        this.kv_event_ended.initEvent('ended', true, true);
        this.kv_event_error = document.createEvent('Event');
        this.kv_event_error.initEvent('error', true, true);
        this.kv_event_waiting= document.createEvent('Event');
        this.kv_event_waiting.initEvent('waiting', true, true);
        this.kv_event_statusupdate = document.createEvent('Event');
        this.kv_event_statusupdate.initEvent('statusupdate', true, true);
    }
    setStatus(status, delay=false){
        clearTimeout(this.status_timer);
        let self = this;
        if (!delay){ 
            this.setAttribute('status',status);
            this.kv_event_statusupdate.status = status;
            this.dispatchEvent(this.kv_event_statusupdate);
            return;
        }
        this.status_timer = setTimeout(function(){
            self.status_timer = undefined;
            self.setAttribute('status',status);
            self.kv_event_statusupdate.status = status;
            self.dispatchEvent(self.kv_event_statusupdate);
        },50);
    }
    get currentUtcTime(){
        if (this.isPlaying())
            return parseInt(this.getAttribute('time')||0) + parseInt(super.currentTime*1000);
        return parseInt(this.getAttribute('playtime') || 0);
    }
    set currentUtcTime(time){
        this.setTimePromise(time).catch(function(){});
    }
    set playbackRate(rate){
        super.playbackRate = rate > 0 ? rate : 0;
    }
    get playbackRate(){
        return super.playbackRate;
    }
    set src(src){
        let self = this;
        let t = src.indexOf(';');let msec;let time;
        if (t<30 && parseInt(src.substr(0,t))!=src.substr(0,t)){
            let v = src.substr(0,t);
            let d = new Date(v);
            if (!isNaN(d)){
                time = d.getTime();
                src = src.substr(t+1);
            }
        }
        t = src.indexOf(';');
        if (t<10){
            let v = src.substr(0,t);
            if (!isNaN(parseInt(v))){
                msec = parseInt(v);
                src = src.substr(t+1);
            }
        }

        this.setSourcePromise(src,time,msec).catch(function(){}).finally(function(){
            if (time || msec){
                if (time) self.setAttribute('playtime',time);
                self.dispatchEvent(self.kv_event_timeupdate);
            }

        });
    }
    get src(){
        return this.original_src;
    }
    play(abort_controller)          {this.setAttribute('autoplay','');return this.playPromise(abort_controller);}
    pause(abort_controller)         {this.removeAttribute('autoplay');return this.pausePromise(abort_controller);}
    superSrc(src)   {super.src = src;}
    isEmpty()       {return !this.original_src;}
    isError()       {return this.getAttribute('error')!==null;}
    getFirstTime()  {return this.getAttribute('time')!==null ? parseInt(this.getAttribute('time') || 0) : undefined;}
    getLastTime()   {return this.getAttribute('msec')!==null ? ((parseInt(this.getAttribute('time') || 0)) + (parseInt((this.getAttribute('duration')||0)*1000) || parseInt(this.getAttribute('msec') || 0)) - 1) : undefined;}
    getInitialLastTime()   {return this.getAttribute('msec')!==null ? ((parseInt(this.getAttribute('time') || 0)) + (parseInt(this.getAttribute('msec') || 0)) - 1) : undefined;}
    isPlaying()     {return !this.paused && this.readyState > 2;}
    isPlayRequired(){return this.getAttribute('autoplay')!==null;}
    isWaiting()     {return this.getAttribute('status')=='waiting';}
    isReadyForPlay(){return super.src && this.getAttribute('loaded')==100;}
    isFull()        {return this.getAttribute('fullload')!==null;}
    isFilled()      {return this.src && (parseInt(this.getAttribute('msec'))>0 || parseInt(this.getAttribute('duration'))>0);}
    isLoaded()      {return !this.load_promise;}
    atStart()       {return this.currentTime==0;}
    atEnd()         {return this.currentTime==this.duration;}

    getRanges(from, to, interval){
        return [this.getFirstTime() || 0,this.getInitialLastTime()||this.getLastTime()||parseInt(this.duration*1000+(this.getFirstTime()||0))||0];
    }

    isOutOfBound(){
        let currentUtcTime = this.currentUtcTime;
        return currentUtcTime<this.getFirstTime() || currentUtcTime>this.getLastTime();
    }

    abort(abort_controller){
        if (this.abort_controller) this.abort_controller.abort();
        this.abort_controller = abort_controller ? abort_controller : new AbortController();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (this.do_not_attr_callback) return;
        if (name="src"){
            let utc_from_in_msec = this.getAttribute('time')===null ? undefined : parseInt(this.getAttribute('time'));
            let duration_msec = this.getAttribute('msec')===null ? undefined : parseInt(this.getAttribute('msec'));
            this.setSourcePromise(newValue, utc_from_in_msec, duration_msec, this.getAttribute('fullload')!==null).catch(function(e){});
        }
    }

    connectedCallback() {
        let self = this;
        this.players_layer = this;
        this.addEventListener("timeupdate", function() { 
            let time = self.currentUtcTime;
            if (isNaN(time) || self.isEmpty() || self.isError()) {
                self.removeAttribute('playtime');
                self.setStatus('pause');
            } else 
                if (self.isPlaying())
                    self.setAttribute('playtime', time);
//            if (time>0 && time<100000) debugger;
        },false);
        this.addEventListener("error", function(e) { 
            self.setStatus('error');
            self.removeAttribute('playtime');
            self.removeAttribute('duration');self.removeAttribute('loaded');self.removeAttribute('fullload');
            let err='MEDIA_ERR_UNDEFINED';
            if (e&&e.target&&e.target.error&&e.target.error.code){
                switch(e.target.error.code){
                    case e.target.error.MEDIA_ERR_ABORTED: err='MEDIA_ERR_ABORTED'; break;
                    case e.target.error.MEDIA_ERR_NETWORK: err='MEDIA_ERR_NETWORK'; break;
                    case e.target.error.MEDIA_ERR_DECODE: err='MEDIA_ERR_DECODE'; break;
                    case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED: err='MEDIA_ERR_SRC_NOT_SUPPORTED'; break;
                }
            } 
            self.setAttribute('error',err);
            if (self.pause_promise) self.pause_promise_reject();
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            if (self.load_promise) self.load_promise_reject(self.abort_controller);
            if (self.seek_promise) self.seek_promise_reject(self.abort_controller);
        },false);
        this.addEventListener("durationchange", function(r) { 
            self.setAttribute('duration',this.duration || 0);
        });
        this.addEventListener("canplay", function(r) { 
            if (self.getAttribute('loaded')===null) self.setAttribute('loaded',0);
            if (self.load_promise) self.load_promise_resolve(self.abort_controller);
//            self.setStatus(self.isPlayRequired() ? 'playing' : 'pause');
        });
        this.addEventListener("canplaythrough", function(r) { 
            self.setAttribute('loaded',100);
//            self.setStatus(self.isPlayRequired() ? 'playing' : 'pause');
        });
        this.addEventListener("ended", function() { 
//            self.playRequired = false;
            self.setStatus('pause');
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            if (self.pause_promise) self.pause_promise_resolve();
        },false);
        this.addEventListener("waiting", function() { 
            self.setStatus('loading',true);
        },false);
        this.addEventListener("playing", function() { 
            self.setStatus('playing');
            if (self.play_promise) self.play_promise_resolve(self.abort_controller);
            if (self.pause_promise) self.pause_promise_reject();
        },false);
        this.addEventListener("pause", function() { 
            self.setStatus('pause');
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            if (self.pause_promise) self.pause_promise_resolve();
        },false);
        this.addEventListener("loadstart", function() { 
            self.setStatus('loading',true);
            self.removeAttribute('duration');self.setAttribute('loaded',0);
        },false);
        this.addEventListener("seeking", function() { 
            self.setStatus('seeking',true);
        },false);
        this.addEventListener("seeked", function() { 
            if (self.isPlayRequired()) self.setStatus('playing'); else self.setStatus('pause');
            if (self.seek_promise) self.seek_promise_resolve(self.abort_controller);
        },false);
        this.addEventListener("emptied", function() { 
            self.setStatus('pause');
            self.removeAttribute('playtime');
            self.removeAttribute('duration');self.removeAttribute('loaded');
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            if (self.pause_promise) self.pause_promise_resolve();
            if (self.seek_promise) self.seek_promise_reject(self.abort_controller);
        },false);
        this.addEventListener("progress", function(r) { 
            let percent = null;
            if (r.srcElement.buffered.length > 0 && r.srcElement.buffered.end && r.srcElement.duration) {
                percent = r.srcElement.buffered.end(0) / r.srcElement.duration;
            } else if (r.srcElement.bytesTotal != undefined && r.srcElement.bytesTotal > 0 && r.srcElement.bufferedBytes != undefined) {
                percent = r.srcElement.bufferedBytes / r.srcElement.bytesTotal;
            }
            self.setAttribute('duration',r.srcElement.duration || 0);
            if (percent !== null) {
                percent = 100 * Math.min(1, Math.max(0, percent));
                if (self.getAttribute('loaded')!==null && parseInt(self.getAttribute('loaded'))<percent)
                    self.setAttribute('loaded',parseInt(percent));
            }
        },false);
        function changedFullscreen(e){
            if (document.webkitIsFullScreen !== true) return;
            if(self.parentElement.mozRequestFullScreen) {
                self.parentElement.mozRequestFullScreen();
            } else if(self.parentElement.webkitRequestFullscreen) {
                self.parentElement.webkitRequestFullscreen();
            } else if(self.parentElement.requestFullscreen) {
                self.parentElement.requestFullscreen();
            } else if(self.parentElement.msRequestFullscreen) {
                self.parentElement.msRequestFullscreen();
            }
        }
        this.addEventListener("click", function(e) { 
//changedFullscreen(e);
        },false);

        document.addEventListener('webkitfullscreenchange', changedFullscreen, false);
        document.addEventListener('mozfullscreenchange', changedFullscreen, false);
        document.addEventListener('fullscreenchange', changedFullscreen, false);
        document.addEventListener('MSFullscreenChange', changedFullscreen, false);
    }

    loadPromise(){
        if (this.load_promise) return this.load_promise;
        return new Promise(function(resolve, reject){resolve();});
    }
    clearAllFlags(){
        this.removeAttribute('time');
        this.removeAttribute('msec');
        this.removeAttribute('playtime');
        this.removeAttribute('duration');
        this.removeAttribute('loaded');
        this.removeAttribute('error');
        this.removeAttribute('fullload');
        this.removeAttribute('status');
    }

    setSourcePromise(src, utc_from_in_msec, duration_msec, full_load){
        let self = this;
        if (src) {
            if (this.original_src == src){
                if (this.load_promise) return this.load_promise;
                return new Promise(function(resolve, reject){resolve(self.abort_controller);});
             }
            this.original_src = src;
        } else {
            this.clearAllFlags();
            if (!this.original_src) {
                if (this.load_promise) return this.load_promise;
                return new Promise(function(resolve, reject){resolve(self.abort_controller);});
            }
            this.original_src = undefined;
            self.removeAttribute('src');
//            try{self.load();}catch(e){};
            return new Promise(function(resolve, reject){resolve(self.abort_controller);});
        }
        this.abort();

        this.clearAllFlags();
        if (src && !isNaN(utc_from_in_msec))
            self.setAttribute('time',parseInt(utc_from_in_msec));
        if (src && !isNaN(duration_msec))
            self.setAttribute('msec',parseInt(duration_msec));
//        if (duration_msec>100000) debugger;

        if (self.pause_promise) self.pause_promise_reject(); self.pause_promise = undefined;
        if (self.play_promise) self.play_promise_reject(self.abort_controller); self.play_promise = undefined;
        if (self.seek_promise) self.seek_promise_reject(self.abort_controller); self.seek_promise = undefined;
        if (self.load_promise) self.load_promise_reject(self.abort_controller); self.load_promise = undefined;

        function tryLoad(src){
            if (self.abort_controller) self.abort_controller.signal.addEventListener('abort', function(){
                if (self.load_promise) self.load_promise_reject(self.abort_controller);
                self.load_promise=undefined;
            });
            self.load_promise = new Promise(function(resolve, reject){
                self.load_promise_resolve = resolve;
                self.load_promise_reject = reject;
            }).then(function(){
                self.load_promise=undefined;
                if (self.isPlayRequired()) self.setStatus('playing'); else self.setStatus('pause');
                return self.abort_controller;
            },function(err){
                self.load_promise=undefined;
//                if (self.isPlayRequired()) self.setStatus('playing'); else self.setStatus('pause');
                if (!(err instanceof AbortController)) self.setStatus('error');
                throw err;
            });
            self.do_not_attr_callback=true;
            if (!src)
                self.removeAttribute('src');
            else{
                self.setAttribute('src',src);
                self.superSrc(src);
            }
            delete self.do_not_attr_callback;
            self.load();
            return self.load_promise;
        }
        if (full_load!==undefined && !full_load || full_load!==undefined && self.getAttribute('fulload')===null) return tryLoad(src);
        self.setAttribute('loaded',0);
        self.dispatchEvent(self.kv_event_waiting);

        return fetch(src,{signal:self.abort_controller.signal,  headers: { range: 'bytes=0-100000000' } }).then(function(res){
            if (parseInt(res.status/100)!==2)
                return tryLoad(src);
            return res.blob().then(function(blob){
                self.setAttribute('fullload','');
                return tryLoad(window.URL.createObjectURL(blob));
            });
        },function(err){
            if (err.code!==undefined && err.code == err.ABORT_ERR){
                if (self.isPlayRequired()) self.setStatus('playing'); else self.setStatus('pause');
                throw err;
            }
//            console.warn('Full load failed. May be CORS?')
            return tryLoad(src);
        });
    }
    toStart(){
        let time = parseInt(this.getAttribute('time')||0);
        return this.setTimePromise(time);
    }
    toEnd(abort_controller){
        if (abort_controller && this.abort_controller!=abort_controller) {
            this.abort_controller.abort();
            this.abort_controller = abort_controller;
        }
        let time = parseInt(this.getAttribute('time')||0) + parseInt(this.getAttribute('msec')||0);
        return this.setTimePromise(time, abort_controller);
    }
    setTimePromise(utc_milliseconds, abort_controller){
        if (!this.isPlaying())
            this.setAttribute('playtime', utc_milliseconds);
        if (abort_controller && this.abort_controller!=abort_controller) {
            this.abort_controller.abort();
            this.abort_controller = abort_controller;
        }

        let self = this;
        let time = parseInt(self.getAttribute('time')) || 0;
        let currentTime = parseFloat(utc_milliseconds - time)/1000;
        if (this.seek_promise) {
            this.setSuperCurrentTime(currentTime);
            return this.seek_promise;
        }
        if (this.isEmpty() || this.isError())
            return new Promise(function(resolve, reject){reject();});
        if (super.currentTime!=currentTime){
//console.log('Seeking to '+currentTime);
            self.seek_promise = new Promise(function(resolve, reject){
                self.seek_promise_resolve = resolve;
                self.seek_promise_reject = reject;
            }).then(function(){
//console.log('Seek end');
                if (self.isPlayRequired()) self.setStatus('playing'); else {
                    if (utc_milliseconds>self.getLastTime() || utc_milliseconds<self.getFirstTime())
                        self.setStatus('nodata');
                    else
                        self.setStatus('pause');
                }
                self.seek_promise=undefined;
                return abort_controller;
            },function(err){
//console.log('Seek fail');
                if (self.isPlayRequired()) self.setStatus('playing'); else self.setStatus('pause');
                self.seek_promise=undefined;
                throw err;
            });
//            self.setStatus('loading');
            self.setSuperCurrentTime(currentTime);
            if (abort_controller) abort_controller.signal.addEventListener('abort', function(){
                if (self.seek_promise) self.seek_promise_reject(self.abort_controller);
                self.seek_promise=undefined;
            });
            return self.seek_promise;
        }
        return new Promise(function(resolve, reject){resolve(abort_controller);});
    }
    setPlaybackRatePromise(speed){
        this.playbackRate = speed;
        return new Promise(function(resolve, reject){resolve();});
    }
    disconnectedCallback(){
        if (this.play_promise)  this.play_promise_reject();
        if (this.seek_promise)  this.seek_promise_reject();
        if (this.pause_promise) this.pause_promise_reject();
        if (this.load_promise)  this.load_promise_reject();
    }

    setSuperCurrentTime(time){
        if (isNaN(time))
            debugger;
        super.currentTime = time;
    }
    preparePlay(abort_controller){
        if (abort_controller && this.abort_controller!=abort_controller) {
            this.abort_controller.abort();
            this.abort_controller = abort_controller;
        }
        let self = this;
        if (this.pause_promise)
            this.pause_promise_reject();
        if (this.isEmpty()) setTimeout(function(){self.dispatchEvent(self.kv_event_ended);},0);
        if (this.isError()) setTimeout(function(){if (self.isError()) self.dispatchEvent(self.kv_event_error);},0);
        if (this.isEmpty() || this.isError())
            return new Promise(function(resolve, reject){reject();});
        if (this.isPlaying())
            return new Promise(function(resolve, reject){resolve();});
        if (this.play_promise) 
            return this.play_promise;
    }
    playPromise(abort_controller){
        this.setAttribute('autoplay','')
        let self = this;
        let p = this.preparePlay(abort_controller);
        if (p) return p;
        if (this.atEnd()){
            setTimeout(function(){self.dispatchEvent(self.kv_event_ended);},0);
            if (this.getAttribute('norepeat')!==null)
                return new Promise(function(resolve, reject){resolve(abort_controller);});
        }
        this.play_promise = new Promise(function(resolve, reject){
            self.play_promise_resolve = resolve;
            self.play_promise_reject = reject;
        }).then(function(abort_controller){
            self.setStatus('playing');
            self.play_promise=undefined;
            return abort_controller;
        },function(err){
            self.play_promise=undefined;
//            if (err instanceof AbortController) return err;
            throw err;
        });
        super.play();
        if (abort_controller) abort_controller.signal.addEventListener('abort', function(){
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            self.play_promise=undefined;
        });
        return this.play_promise;
    }
    superPause(){
        super.pause();
    }
    pausePromise(abort_controller){
        this.removeAttribute('autoplay')
        if (abort_controller && this.abort_controller!=abort_controller)
            this.abort(abort_controller);
        let self = this;
        if (self.play_promise) self.play_promise_reject(self.abort_controller);
        if (this.pause_promise) return this.pause_promise;
        if (!this.isPlaying())
            return new Promise(function(resolve, reject){resolve();});
        self.pause_promise = new Promise(function(resolve, reject){
            self.pause_promise_resolve = resolve;
            self.pause_promise_reject = reject;
        }).then(function(abort_controller){
            self.setStatus('pause');
            self.pause_promise=undefined;
            return abort_controller;
        },function(err){
            self.pause_promise=undefined;
            throw err;
        });
        super.pause();
        if (abort_controller) abort_controller.signal.addEventListener('abort', function(){
            if (self.pause_promise) self.pause_promise_reject(self.abort_controller);
            self.pause_promise=undefined;
        });
        return self.pause_promise;
    }
}

window.customElements.define('k-video', CKVideo, {extends: 'video'});

