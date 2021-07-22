/* 2021, dev mail bigandrez@gmail.com, license type has not been selected yet */

class CKVideoSet extends HTMLElement{
    get LEFT_BUFFER_SIZE(){return this.options.left_prefetch || 3;};
    get RIGHT_BUFFER_SIZE(){return this.options.right_prefetch  || 3;};
    constructor() {
        super();
        this.event_timeupdate = new Event('timeupdate',{cancelable: false, bubbles: true});
        this.event_loadstart = new Event('loadstart',{cancelable: false, bubbles: true});
        this.event_loadedmetadata = new Event('loadedmetadata',{cancelable: false, bubbles: true});
        this.options = this.getAttribute('options')===null ? {} : JSON.parse(this.getAttribute('options'));

        this.event_statusupdate = document.createEvent('Event');
        this.event_statusupdate.initEvent('statusupdate', true, true);
    }
    getRanges(from, to, interval){
        let ret = [];

        for(let srcelement of this.source_list_element.children) {
            let time = srcelement.getAttribute('time');
            let msec = srcelement.getAttribute('msec');
            if (time===null || msec===null) continue;
            time = parseInt(time);
            if (isNaN(time)) continue;
            msec = parseInt(msec);
            if (isNaN(msec)) continue;
            ret.push(time);
            ret.push(time+msec-1);
        }
        return ret;
    }
    sendTimeUpdate(){
        this.dispatchEvent(this.event_timeupdate);
    }
    // overload base functions
    get currentUtcTime(){
        return parseInt(this.getAttribute('playtime')||0);
//        return this.shadow.querySelector('[pos="0"]').currentUtcTime;
    }
    set currentUtcTime(time){
        if (this.shadow.querySelector('[pos="0"]').currentUtcTime == time) 
            return;
        this.setTimePromise(time).catch(function(){});
    }
    get playbackRate(){
        return this.speed;
    }
    set playbackRate(speed){
        this.setPlaybackRatePromise(speed).catch(function(){});
    }
    get volume(){
        return this.shadow.querySelector('[pos="0"]').volume;
    }
    set volume(volume){
        volume = volume > 1 ? 1 : (volume<0?0:volume);
        for (let i=-this.LEFT_BUFFER_SIZE; i<=this.RIGHT_BUFFER_SIZE; i++)
            this.shadow.querySelector('[pos="'+i+'"]').volume = volume;
    }
    isPlaying(){
        return this.getAttribute('autoplay')!==null;
    }
    play(){
        this.setAttribute('autoplay','');
//        this.removeAttribute('nodata');
        let player = this.shadow.querySelector('[pos="0"]');
//        this.setAttribute('playing','');
        if (0 && this.speed<0 && !player.isEmpty() && !player.isFull()){
            this.setStatus('seeking', this.speed<0);
//            this.setWait();
            let src = player.src; 
            let time = player.getFirstTime(); 
            let msec = parseInt(parseInt(player.getAttribute('duration')*1000) || player.getAttribute('msec') || 0);
            return player.updateState();
/*
            return player.setSourcePromise().then(function(abort_controller){
                return player.setSourcePromise(src, time, msec, true).then(function(abort_controller){
                    return player.updateState(abort_controller);
                });
            });
*/
        }

        if (player.isPlaying() || player.isWaiting()) 
            return new Promise(function(resolve, reject){resolve();});
        return player.play().catch(function(){});
    }
    pause(){
        this.removeAttribute('autoplay');
//        this.setStatus('pause');
        return this.shadow.querySelector('[pos="0"]').pause();
    }

    // debug info
    onDebugInfo(){
        return '';
    }
    connectedCallback() {
        let self = this;
        this.setStatus('nodata');
        if (this.innerText=='') this.innerHTML='';
        this.shadow = this.attachShadow({mode: 'open'});
        let video_tag = 'k-video-reverse';
        if (typeof CKVideoReverse==="undefined" || this.getAttribute('noreverse')!==null) {
            if (typeof CKVideo==="undefined"){
                console.error('No CKVideo or CKVideoReverse class - player disabled');
                return;
            }
            video_tag = 'k-video';
        }

        let pb = '<video preload norepeat is="'+video_tag+'" pos="0"></video>';
        for (let i=0; i<this.LEFT_BUFFER_SIZE; i++) pb = '<video preload norepeat is="'+video_tag+'" pos="-'+(i+1)+'"></video>' + pb;
        for (let i=0; i<this.RIGHT_BUFFER_SIZE; i++) pb += '<video preload norepeat is="'+video_tag+'" pos="'+(i+1)+'"></video>';
        this.shadow.innerHTML = '<style>'+this.getCss()+'</style>'+(this.getAttribute('debuginfo')!==null?'<div class="debuginfo"></div>':'')+'<div class="players">'+pb+'</div>';
        this.players_layer = this.shadow.querySelector('.players');
        this.debuginfo = this.shadow.querySelector('.debuginfo');
        if (typeof this.updateDebugInfo=="function") this.updateDebugInfo();

        function setSourceForTimePromise(utctime, to_left, accuracy){
            let it = this;
            let source_data = to_left===true ? self.getLastSrcBeforeTime(utctime+1) : self.getFirstSrcFromTime(utctime);
            if (!source_data || (accuracy && (source_data.time>utctime || source_data.time+source_data.msec<utctime))) 
                return this.setSourcePromise();
            return this.setSourcePromise(source_data.src, source_data.time, source_data.msec, to_left /*&& self.isPlaying()*/).finally(function(){
//                if (it.getAttribute('pos')==0 && it.isReadyForPlay())
//                    self.clearWait();
            });
        }
        function updateState(abort_controller){
            let it = this;
            if (!abort_controller) abort_controller = this.abort();

            if (this.getAttribute('pos')!=0){
                if (this.isError() || this.isEmpty())
                    return new Promise(function(resolve, reject){resolve(abort_controller);});
                if (parseInt(this.getAttribute('pos'))<0)
                    return this.toEnd().then(function(){
                        if (it.isPlaying())
                            return it.pause(abort_controller).catch(function(){});
                        return new Promise(function(resolve, reject){resolve(abort_controller);});
                    }).catch(function(e){});

                if (this.isPlaying())
                    return this.pause(abort_controller).catch(function(){});
                return new Promise(function(resolve, reject){resolve(abort_controller);}).then(function(){
                    if (self.getAttribute('autoplay')===null) return abort_controller;
                    let cp = self.shadow.querySelector('[pos="0"]');
                    if (!cp.isPlaying() && self.isPlaying() && (it.getAttribute('pos')==1 && self.speed>=0 || it.getAttribute('pos')==-1 && self.speed<0))
                        self.onPlayNextBlock();
                    return abort_controller;
                });
            }
            if (this.isError() || this.isEmpty()){
//                self.clearWait();
                self.setStatus('nodata');
                if (this.isError()) return new Promise(function(resolve, reject){reject();});
                return new Promise(function(resolve, reject){resolve();});
            }
            let playtime = parseInt(self.getAttribute('playtime')||0);
            if (self.getAttribute('autoplay')!=null){
                if (playtime<this.getFirstTime() || playtime>this.getLastTime()){
//                    self.clearWait();
                    self.setStatus('nodata');
                }else{
//                    self.setStatus('pause');
                }
            }

            return this.setTimePromise(playtime, abort_controller).then(function(abort_controller){
                return it.setPlaybackRatePromise(self.speed).then(function(){
                    if (it.getAttribute('pos')!=0)
                        return it.isPlaying() ? it.pause(abort_controller).catch(function(){}) : abort_controller;
//                    self.clearWait();
                    if (self.getAttribute('autoplay')===null && it.isReadyForPlay()){
                        let playtime = parseInt(self.getAttribute('playtime')||0);
                        if (playtime<it.getFirstTime() || playtime>it.getLastTime())
                            self.setStatus('nodata');
                        else
                            self.setStatus('pause');
                    }
                    if (self.getAttribute('autoplay')!==null && !it.isPlaying())
                        return it.play(abort_controller).catch(function(err){
                            if (err instanceof AbortController)
                                return err;
                            self.setStatus('nodata');
                        });
                    if (self.getAttribute('autoplay')===null && it.isPlaying())
                        return it.pause(abort_controller).catch(function(){});
                    return new Promise(function(resolve, reject){resolve(abort_controller);});
                });
            },function(err){
                if (it.getAttribute('pos')==0){
//                    self.clearWait();
                    self.setStatus('nodata');
                }
                throw err;
            });
        }
        function setTimeWithSourcePromise(utctime, to_left, accuracy){
            let it = this;
            return this.setSourceForTimePromise(utctime, to_left, accuracy).then(function(abort_controller){
                return it.updateState(abort_controller);
            }/*,function(abort_controller){
                if (abort_controller instanceof AbortController) throw abort_controller;
                return it.updateState(abort_controller);
            }*/);
        }

        this.setListiners(this.shadow.querySelector('[pos="0"]'));

        this.onCanPlay = function(){
        }
        for (let i = -this.LEFT_BUFFER_SIZE; i<=this.RIGHT_BUFFER_SIZE; i++)
            this.shadow.querySelector('[pos="'+i+'"]').addEventListener("canplay", this.onCanPlay,{once:false});


        for (let s of this.shadow.querySelectorAll('video')) {
            s.setSourceForTimePromise = setSourceForTimePromise;
            s.setTimeWithSourcePromise = setTimeWithSourcePromise;
            s.updateState = updateState;
        }

        this.speed=1;
        this.setSourceListObserver(this);

        this.addEventListener("loadstart", function(){
            let player = self.shadow.querySelector('[pos="0"]');
            if (player && player.isEmpty())
                self.setStatus('loading');
        },{once:false});
        this.addEventListener("waiting", function(){
            self.setStatus('loading');
        },{once:false});

    }
    setWait2(deferred){
        let self = this;
        if (this.set_wait_timer) clearTimeout(this.set_wait_timer);
        if (!deferred){
            this.setAttribute('waiting','');
            return;
        }
        this.set_wait_timer = setTimeout(function(){
            self.setAttribute('waiting','');
        },200);
    }
    clearWait2(){
//console.trace();
        if (this.set_wait_timer) clearTimeout(this.set_wait_timer);
        delete this.set_wait_timer;
        this.removeAttribute('waiting');
    }
    setPlayTime(time){
if (time<0) debugger;
        this.setAttribute('playtime', time);
    }
    setListiners(player){
        let self = this;
        this.onTimeUpdateEvent = function(){
//            self.clearWait();
            if (!self.shadow || !this.isLoaded()) return;
            if (this.isPlaying() && this.playbackRate<0) self.setStatus('playing');
            const player = self.shadow.querySelector('[pos="0"]');
            if (!player) return;
            let time = player.currentUtcTime;
            if (!isNaN(time)) {
                if (self.getAttribute('playtime')!=time){
                    self.prev_time = parseInt(self.getAttribute('playtime')||0);
                    self.setPlayTime(time);

                    let current_time = new Date().getTime();
                    if (!self.last_time_update || current_time - self.last_time_update >500){
                        setTimeout(function(){self.sendTimeUpdate();},0);
                        self.last_time_update = current_time;
                    }
                }
            }
        }
/*
        this.onSeeking= function(){
            self.setStatus('seeking', self.speed<0);
        }
        this.onSeekend= function(){
            self.setStatus(self.getAttribute('autoplay')!==null ? 'playing' : 'pause');
        }
*/
        this.onLoading = function(e){
            self.dispatchEvent(self.event_loadstart);
//console.log('onLoading');
//            self.setStatus('loading');
        }
        this.onPlayNextBlock = function(){
            self.setStatus('seeking',true);
            let player = self.shadow.querySelector('[pos="0"]');
            if (self.speed>=0){
                let lt = player.getLastTime();
                if (lt!==undefined) {
                    self.prev_time = parseInt(self.getAttribute('playtime')||0);
                    self.setPlayTime(lt+1);
                }
            } else {
                let lt = player.getFirstTime();
                if (lt!==undefined) {
                    self.prev_time = parseInt(self.getAttribute('playtime')||0);
                    self.setPlayTime(lt-1);
                }
            }

            if (/*player.isEmpty() && */!self.checkNextBlock()){
                self.updateCache();
                return;
            }
            player = self.shiftToNextBlock();
            if (player.isEmpty()){
                self.setStatus('nodata');
                self.updateCache();
                return;
            }
            if (!player.isError()){
                self.setPlayTime(self.speed>=0 ? player.getFirstTime() : player.getLastTime());
                if (!player.isLoaded()){
                    self.setStatus('loading',true);
                    return;
                }
                player.setTimeWithSourcePromise(self.speed>=0 ? player.getFirstTime() : player.getLastTime(),false,true).catch(function(){}).finally(function(){
                    self.updateCache();
                });
                return;
            } else
                self.setStatus('nodata');
            self.onPlayNextBlock();
        }
        this.onStatusUpdate = function(event){
            self.setStatus(event.status);
        }
        this.onLoadedmetadata = function(event){
            self.event_loadedmetadata.srcVideo = event.srcElement;
            self.dispatchEvent(self.event_loadedmetadata);
        }
        player.addEventListener("statusupdate", this.onStatusUpdate,{once:false});

//        player.addEventListener("seeking", this.onSeeking,{once:false});
//        player.addEventListener("seekend", this.onSeekend,{once:false});
        player.addEventListener("ended", this.onPlayNextBlock,{once:false});
        player.addEventListener("waiting", this.onLoading,{once:false});
        player.addEventListener("loadstart", this.onLoading,{once:false});
        player.addEventListener("timeupdate", this.onTimeUpdateEvent,{once:false});
        player.addEventListener("loadedmetadata", this.onLoadedmetadata,{once:false});
    }
    setStatus(status, delay=false){
//console.log(status);
//console.trace();
        clearTimeout(this.status_timer);
        if (this.getAttribute('status')===status) return;
        let self = this;
        if (!delay){ 
            this.setAttribute('status',status);
            this.event_statusupdate.status = status;
            this.dispatchEvent(this.event_statusupdate);
            return;
        }
        this.status_timer = setTimeout(function(){
            self.status_timer = undefined;
            self.setAttribute('status',status);
            self.event_statusupdate.status = status;
            self.dispatchEvent(self.event_statusupdate);
        },50);
    }

    shiftToNextBlock(){
        if (this.speed>=0){
            let p = this.shadow.querySelector('[pos="-'+this.LEFT_BUFFER_SIZE+'"]');
            for (let i = -this.LEFT_BUFFER_SIZE+1; i<=this.RIGHT_BUFFER_SIZE; i++){
                let np = this.shadow.querySelector('[pos="'+i+'"]');
                this.swapPlayers(p,np);
                np.pause().catch(function(){});
            }
            p.setSourcePromise().catch(function(err){});
            return this.shadow.querySelector('[pos="0"]');
        }
        let p = this.shadow.querySelector('[pos="'+this.RIGHT_BUFFER_SIZE+'"]');
        for (let i = this.RIGHT_BUFFER_SIZE-1; i>=-this.LEFT_BUFFER_SIZE; i--){
            let np = this.shadow.querySelector('[pos="'+i+'"]');
            this.swapPlayers(p,np);
            np.pause().catch(function(){});
        }
        p.setSourcePromise().catch(function(err){});
        return this.shadow.querySelector('[pos="0"]');
    }
    removeListiners(player){
        player.removeEventListener("statusupdate", this.onStatusUpdate);

        player.removeEventListener("waiting", this.onLoading);
        player.removeEventListener("loadstart", this.onLoading);
//        player.removeEventListener("seeking", this.onSeeking);
//        player.removeEventListener("seekend", this.onSeekend);
        player.removeEventListener("ended", this.onPlayNextBlock);
        player.removeEventListener("error", this.onPlayNextBlock);
        player.removeEventListener("timeupdate", this.onTimeUpdateEvent);
        player.removeEventListener("loadedmetadata", this.onLoadedmetadata);
    }
    setSourceListObserver(v){
        let self = this;
        this.source_list_element = v;
        this.source_list_observer = new MutationObserver(function(mutations) {self.onSourceListChange(mutations);});
        this.source_list_observer.observe(v, {childList: true}); // attributes: true, characterData: true, subtree: true, attributeOldValue: true, characterDataOldValue: true,
    }
    onSourceListChange(mutations){
        this.updateCache();
    }
    setPlaybackRatePromise(speed){
        if ((typeof CKVideoReverse==="undefined" || this.getAttribute('noreverse')!==null) && speed<0) speed=0;
        let self = this;
        const player = this.shadow.querySelector('[pos="0"]');
        this.speed = speed;
        if (speed>=0) this.removeAttribute('reverseplay');
        else this.setAttribute('reverseplay','');
        return player.setPlaybackRatePromise(speed).finally(function(){
            if (parseInt(player.getAttribute('pos'))!==0) return;
            if (self.getAttribute('autoplay')!==null)
                return player.play().catch(function(){});
        }).catch(function(){});
    }

    setTimePromise(utctime){
//if (utctime===0) debugger;
        if (this.getAttribute('playtime')!==null && parseInt(this.getAttribute('playtime'))==utctime)
            return new Promise(function(resolve, reject){resolve();});
        this.shift_to_more = (this.last_time||0) <= utctime;
        this.last_time = utctime;
        let self = this;
        let player = this.shadow.querySelector('[pos="0"]');
        if (!player.isPlaying() && !player.isWaiting()){
            if (isNaN(utctime))
                debugger;
            this.prev_time = parseInt(this.getAttribute('playtime')||0);
            this.setPlayTime(utctime);
        }
        let source_data = this.speed<0 ? this.getLastSrcBeforeTime(utctime+1) : this.getFirstSrcFromTime(utctime);
        if (self.getAttribute('autoplay')===null && (!source_data || utctime<source_data.time || utctime>=source_data.time+source_data.msec)){
            this.setStatus('nodata');
        } 
        this.setStatus(this.getAttribute('autoplay')!==null ? 'playing' : 'pause');
        return player.setTimeWithSourcePromise(utctime, this.speed<0, false).catch(function(){}).then(function(){
            self.updateCache();
        }).catch(function(){});
    }
    getTime(){
        const player = this.shadow.querySelector('[pos="0"]');
        return player.currentUtcTime();
    }
    swapPlayers(v1, v2){
        let pos1 = parseInt(v1.getAttribute('pos'));
        let pos2 = parseInt(v2.getAttribute('pos'));
        if (pos1 == pos2 || v1==v2) return;
        if (pos1==0) this.removeListiners(v1);
        if (pos2==0) this.removeListiners(v2);

        v1.setAttribute('pos',pos2);
        v2.setAttribute('pos',pos1);

        if (pos1==0) this.setListiners(v2);
        if (pos2==0) this.setListiners(v1);
    }
    getPlayerWithSrc(src){
        if (!src) return;
        for (let i=-this.LEFT_BUFFER_SIZE; i<=this.RIGHT_BUFFER_SIZE; i++) {
            let p = this.shadow.querySelector('[pos="'+i+'"]');
            if (p.src==src)
                return p;
        }
    }
    getEmptyPlayer(){
        for (let i=-this.LEFT_BUFFER_SIZE; i<=this.RIGHT_BUFFER_SIZE; i++) {
            let p = this.shadow.querySelector('[pos="'+i+'"]');
            if (p.isEmpty())
                return p;
        }
    }
    invalidate(){
        let self = this;
        return this.pause().finally(function(){
            for (let i=-self.LEFT_BUFFER_SIZE; i<=self.RIGHT_BUFFER_SIZE; i++)
                self.shadow.querySelector('[pos="'+i+'"]').setSourcePromise().catch(function(){});
            self.setStatus('nodata');
            self.updateCache();
        }).catch(function(){});
    }
    updateCache(){
        let self = this;
        let player = this.shadow.querySelector('[pos="0"]');
        if (!player) return;
        let playtime = parseInt(this.getAttribute('playtime'));
        if (isNaN(playtime)){
            playtime = this.getLastTime();
            if (playtime!==undefined){
                this.setPlayTime(playtime);
                setTimeout(function(){self.sendTimeUpdate();},0);
            } else
                playtime = new Date().getTime();
        }

        let last_left = player.getFirstTime()!==undefined ? player.getFirstTime() : playtime;
        let last_right = player.getInitialLastTime()!==undefined ? player.getInitialLastTime()+1 : playtime; 
        let no_data_before, no_data_from;
        function tryToRight(onlymain){
            for (let i=0; i<=self.RIGHT_BUFFER_SIZE; i++) {
                if (i==0 && !player.isEmpty()) continue;
                if (onlymain && i>0) return;
                let p = self.shadow.querySelector('[pos="'+i+'"]');
                if (i!=0) p.pause().catch(function(){});
                let src = self.getFirstSrcFromTime(last_right);
                if (!src && (no_data_from===undefined || no_data_from>last_right)){
                    no_data_from = last_right;
                    self.setAttribute('reqfrom',no_data_from);
                } else
                if ((!p.src && !src) || (src && p.src == src.src)) {
                    if (src) last_right = src.time+src.msec;
                    continue;
                }
                if (src && i==0 && src.time>last_right){
                    continue;
                }
                let op = src ? self.getPlayerWithSrc(src.src) : undefined;
                if (op){
                    self.swapPlayers(p,op);
                    last_right = op.getInitialLastTime()+1;
                    op.setTimeWithSourcePromise(op.getFirstTime(),false,true).catch(function(){});
                    continue;
                }
                if (!src)
                    p.setSourcePromise().catch(function(){});
                else {
                    if (last_left>src.time-1) last_left=src.time-1;
                    p.setTimeWithSourcePromise(last_right,false).catch(function(){});
                    last_right = src.time+src.msec;
                }
            }
        }
        function tryToLeft(){
            for (let i = 0; i<=self.LEFT_BUFFER_SIZE; i++) {
                if (i==0 && !player.isEmpty()) continue;
                let p = self.shadow.querySelector('[pos="'+(i>0?'-':'')+i+'"]');
                p.pause().catch(function(){});
                let src = self.getLastSrcBeforeTime(last_left);
                if (!src && (no_data_before===undefined || no_data_before<last_left)){
                    no_data_before = last_left;
                    self.setAttribute('reqbefore',no_data_before);
                }
                if ((!p.src && !src) || (src && p.src == src.src)) {
                    if (src) last_left = src.time;
                    continue;
                }
                let op = src ? self.getPlayerWithSrc(src.src) : undefined;
                if (op){
                    self.swapPlayers(p,op);
                    last_left = op.getFirstTime();
                    op.setTimeWithSourcePromise(op.getFirstTime(),false,true).catch(function(){});
                    continue;
                }
                if (!src)
                    p.setSourcePromise().catch(function(){});
                else {
                    if (last_right<src.time+src.msec) last_right=src.time+src.msec;
                    p.setTimeWithSourcePromise(last_left-1,true).catch(function(){});
                    last_left = src.time;
                }
            }
        }
        if (this.prev_time < playtime){
            tryToRight(true);
            tryToLeft();
            tryToRight();
        } else {
            tryToRight();
            tryToLeft();
        }
        if (player.isEmpty() || player.isError() || player.isOutOfBound() || playtime<player.getFirstTime() || playtime>player.getLastTime())
            this.setStatus('nodata');
        else if (player.isPlaying())
            this.setStatus('playing');
        else
            this.setStatus('pause');

        if (no_data_before===undefined) this.removeAttribute('reqbefore');
        if (no_data_from===undefined) this.removeAttribute('reqfrom');
            this.onUpdateCache(no_data_before, no_data_from);
    }

    checkNextBlock(){
        if (this.speed>=0) return this.checkAfter();
        return this.checkBefore();
    }
    checkBefore(){
        let i = -this.LEFT_BUFFER_SIZE;
        for (; i<0; i++){
            let p = this.shadow.querySelector('[pos="'+i+'"]');
            if (!p.isEmpty()) break;
        }
        if (i==0) return false;
        return true;
    }
    checkAfter(){
        let i = 1;
        for (; i<=this.RIGHT_BUFFER_SIZE; i++){
            let p = this.shadow.querySelector('[pos="'+i+'"]');
            if (!p.isEmpty()) break;
        }
        if (i>this.RIGHT_BUFFER_SIZE) return false;
        return true;
    }
    getFirstSrcFromTime(from){
        let ret;
        for(let srcelement of this.source_list_element.children) {
            let time = srcelement.getAttribute('time');
            if (time!==null){
                time = parseInt(time);
                if (isNaN(time)) time=0;
            } else time=0;
            let msec = parseInt(srcelement.getAttribute('msec')) || 0;
            if (from<=time+msec-1 && (!ret || ret.time > time)){
                let src = srcelement.getAttribute('src');
                ret = {src:src,time:time,msec:msec};
            }
        }
        return ret;
    }
    getLastSrcBeforeTime(before){
        let ret;
        for(let srcelement of this.source_list_element.children) {
            let time = srcelement.getAttribute('time');
            let msec = srcelement.getAttribute('msec');
            let src = srcelement.getAttribute('src');
            if (time===null || msec===null || src===null) continue;
            time = parseInt(time);
            if (isNaN(time)) continue;
            msec = parseInt(msec);
            if (isNaN(msec)) continue;
            if (before>time && (!ret || ret.time < time)){
                let src = srcelement.getAttribute('src');
                ret = {src:src,time:time,msec:msec};
            }
        }
        return ret;
    }
    getLastTime(){
        let ret=0;
        for(let srcelement of this.source_list_element.children) {
            let time = srcelement.getAttribute('time');
            let msec = srcelement.getAttribute('msec');
            if (time===null || msec===null) continue;
            time = parseInt(time);
            if (isNaN(time)) continue;
            msec = parseInt(msec);
            if (isNaN(msec)) continue;
            if (ret<time+msec) ret=time+msec;
        }
        return ret;
    }
    disconnectedCallback(){
        this.removeListiners(this.shadow.querySelector('[pos="0"]'));
        this.shadow.innerHTML='';
//        delete this.event_timeupdate;
        delete this.event_beforenextblock;
        delete this.event_afternextblock;
    }
    onUpdateCache(no_data_before, no_data_from){
    }

    getCss() {
        return `
.players{width:100%;height:100%;position:relative;}
video{position:absolute;width:100%;height:100%;}
.cachetable{width:100%;height:1em;display:flex;}
.cachetable > div{text-align:center;background:lightgray;flex:1;border:1px solid darkslategray;height:1.2em;width:20px;overflow:hidden;font-size:9px;margin-left:-1px;cursor:pointer;}
.cachetable .center{border:1px solid white;position:relative;z-index:1000;}
.cachetable .error{background:#ff5050;}
.cachetable .ready{background:#50ff50;}
.cachetable .wait{background:#ffff50;}
video:not([pos="0"]),video:not([status]),video[status="nodata"],video[status="error"]{visibility:hidden;}
.debuginfo{font-size:12px;position:absolute;background:#ffffffc0;padding:10px;z-index:10000;font-family:monospace;display:none;}
.cachetable > div:hover{border:1px solid blue;}
`;
    }
}

window.customElements.define('k-video-set', CKVideoSet);
