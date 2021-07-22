/* 2021, dev mail bigandrez@gmail.com, license type has not been selected yet */

class CKVideoReverse extends CKVideo{
    constructor() {
        super();
        this.reverse_event_ended = document.createEvent('Event');
        this.reverse_event_ended.initEvent('ended', true, true);
        this.reverse_event_playing= document.createEvent('Event');
        this.reverse_event_playing.initEvent('playing', true, true);
        this.reverse_event_pause= document.createEvent('Event');
        this.reverse_event_pause.initEvent('pause', true, true);
        this.speed=1;
    }

    get reverseFramerate(){
        const REVERSE_FRAME_RATE = 25; // 12 frame per second in reverse play
        let rf = this.getAttribute('reverse-frame-rate');
        rf = rf === null ? REVERSE_FRAME_RATE : parseInt(rf);
        if (rf<1) rf=1; if (rf>30) rf=30;
        return rf;
    }
    set playbackRate(rate){
        this.setPlaybackRatePromise(rate).catch(function(){});
    }
    get playbackRate(){
        return this.speed;
    }
    pause(abort_controller){
        this.removeAttribute('autoplay');
        return this.pauseWithReversePromise(abort_controller);
    }
    play(abort_controller){
        this.setAttribute('autoplay','');
        if (this.speed>=0)
            return super.play();
        let pr = this.preparePlay(abort_controller);
        if (pr) return pr;
        return this.playWithReversePromise(abort_controller);
    }
    isPlaying() {
        return this.play_reverse_timer || super.isPlaying();
    }
    setSourcePromise(src, utc_from_in_msec, duration_msec, full_load){
        if (this.play_reverse_timer) clearInterval(this.play_reverse_timer); this.play_reverse_timer = undefined;
        return super.setSourcePromise(src, utc_from_in_msec, duration_msec, full_load);
    }
    setPlaybackRatePromise(speed){
        let self = this;
        if (speed<0){
            let p = this.getAttribute('autoplay')!==null;
            self.speed = speed;
            self.setSuperPlaybackRate(-self.speed);
            let r = super.pause().then(function(abort_controller){
                if (self.getAttribute('autoplay')!==null && self.isPlayRequired() && !self.isPlaying() && !self.atStart())
                    return self.play(abort_controller);
                return new Promise(function(resolve, reject){resolve(abort_controller);});
            });
            if (p) this.setAttribute('autoplay','');
            return r;
        }
        if (this.speed<0 && this.isPlayRequired()){
            this.clearReverseTimer();
        }
        this.speed = speed;
        this.setSuperPlaybackRate(speed);
        return new Promise(function(resolve, reject){resolve();}).then(function(){
            if (!self.atEnd() && self.isPlayRequired() && !self.isPlaying()) return self.play();
        });
    }
    disconnectedCallback(){
        this.clearReverseTimer();
        super.disconnectedCallback();
    }

    clearReverseTimer(){
        if (this.play_reverse_timer) {
//console.log('Clear timer');
            clearTimeout(this.play_reverse_timer);
            this.play_reverse_timer = undefined;
        }
    }
    clearPlay(){
        if (this.pause_promise) this.pause_promise_resolve();
        if (this.play_promise) this.play_promise_reject(this.abort_controller);
        this.clearReverseTimer();
        this.setStatus('pause');
        this.dispatchEvent(this.reverse_event_ended);
    }
    playReverseTimer(){
        if (this.speed>=0 || !this.isPlayRequired() || this.play_reverse_timer) 
            return;
        if (super.isPlaying()) 
            super.superPause();

        this.play_reverse_timer = undefined;
        this.setStatus('playing');
        let self = this;
        let time_correct = new Date().getTime();
        let t = self.currentUtcTime - 1/self.reverseFramerate*(-self.speed)*1000;
        if (t<this.getFirstTime() && self.currentUtcTime==this.getFirstTime()){
            this.clearPlay();
            return;
        }
        if (t<this.getFirstTime()) t=this.getFirstTime();
        if (t>this.getLastTime()) t=this.getLastTime();
//console.log('Timer fired');
        return this.setTimePromise(t).catch(function(err){
//console.log('Set time fail');
        }).finally(function(){
//console.log('Set time ok');
            let time = parseInt(self.getAttribute('time')||0);
            if (t>=time) {
                if (!self.play_reverse_timer && self.isPlayRequired()) {
                    let c = new Date().getTime() - time_correct;
                    c = c > 1000/self.reverseFramerate-10 ? 1000/self.reverseFramerate-10 : c;
//console.log('Set timer '+(1000/self.reverseFramerate - c));
                    self.play_reverse_timer = setTimeout(function(){
                        self.play_reverse_timer=undefined;
                        self.playReverseTimer();
                    },1000/self.reverseFramerate - c);
                }
                if (!self.play_reverse_timer){
                    self.setStatus('pause');
                }
                if (self.pause_promise) self.pause_promise_reject();
                if (self.play_promise) self.play_promise_resolve(self.abort_controller);
                return;
            }
            self.clearPlay();
        });
    }
    setSuperPlaybackRate(rate){
        super.playbackRate = rate;
    }
    pauseWithReversePromise(abort_controller){
        if (abort_controller && this.abort_controller!=abort_controller)
            this.abort(abort_controller);
        this.clearReverseTimer();
        if (this.play_promise) this.play_promise_reject(this.abort_controller);
        if (this.speed>=0){
            if (!super.isPlaying())
                return new Promise(function(resolve, reject){resolve();});
            let p = this.getAttribute('autoplay')!=null;
            let r = super.pause(abort_controller);
            if (p) this.setAttribute('autoplay','');
            return r;
        } else
            this.dispatchEvent(this.reverse_event_pause);
        this.setStatus('pause');
        return new Promise(function(resolve, reject){resolve();});
    }
    playWithReversePromise(abort_controller){
        let self = this;
        if (this.atStart()){
            setTimeout(function(){self.dispatchEvent(self.reverse_event_ended);},0);
            if (this.getAttribute('norepeat')!==null)
                return new Promise(function(resolve, reject){resolve(abort_controller);});
            return this.toEnd(abort_controller).then(function(abort_controller){
                if (self.atStart()) return abort_controller;
                return self.playWithReversePromise(abort_controller);
            });
        }

        if (abort_controller && this.abort_controller!=abort_controller)
            this.abort(abort_controller);
        this.play_promise = new Promise(function(resolve, reject){
            self.play_promise_resolve = resolve;
            self.play_promise_reject = reject;
        }).then(function(){
            if (self.pause_promise) self.pause_promise_reject();
            self.dispatchEvent(self.reverse_event_playing);
            self.play_promise=undefined;
        },function(err){
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            if (self.pause_promise) self.pause_promise_resolve();
            self.clearReverseTimer();
            if (self.play_promise) self.play_promise_reject(self.abort_controller);
            self.setStatus('pause');
            self.play_promise=undefined;
//            if (err instanceof AbortController) return err;
            throw err;
        });
        self.playReverseTimer();
        return this.play_promise;
    }
}

window.customElements.define('k-video-reverse', CKVideoReverse, {extends: 'video'});
