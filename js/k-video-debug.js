/* 2021, dev mail bigandrez@gmail.com, license type has not been selected yet */

function CKAddVideoDebug(){
    let self = this;
    if (typeof CKVideoSet==="undefined"){
        setTimeout(function(){
            CKAddVideoDebug();
        },10);
        return;
    }

    CKVideoSet.prototype.updateDebugInfo = function(){
        clearTimeout(this.update_debug_info_timer);this.update_debug_info_timer=undefined;
        let self = this;
        if (!this.debuginfo) return;
        let status = 'pause';
        if (this.getAttribute('playing')!==null) status = 'play';
        if (this.getAttribute('waiting')!==null) status = 'wait';
        let playtime = parseInt(this.getAttribute('playtime'));
        if (!isNaN(playtime)) playtime = new Date(parseInt(this.getAttribute('playtime'))).toISOString().replace('T','&nbsp;'); else playtime='';
        let sel_cache='';
        let cache_table='<div class="cachetable">';
        for (let i = -this.LEFT_BUFFER_SIZE; i<=this.RIGHT_BUFFER_SIZE; i++){
            let np = this.shadow.querySelector('[pos="'+i+'"]');
            if (!np){
                this.update_debug_info_timer = setTimeout(function(){self.updateDebugInfo();},300);
                return;
            }

            let loaded = np.getAttribute('loaded'); let style='';
            let text = '';
            if (loaded){
                loaded = parseInt(loaded);
                style = ' style="background: linear-gradient(to right, #50FF50 0%,#50FF50 '+loaded+'%, #FFFF50 '+loaded+'%,#FFFF50 100%);"';
                text = ''+loaded+'%';
            }
            if (np.getAttribute('fullload')!==null){
                style = ' style="background: #40b040;"';
            }
            if (loaded=="100"){
                let l1 = parseInt(np.getAttribute('msec'));
                let l2 = parseFloat(np.getAttribute('duration'));
                if (!isNaN(l1) && !isNaN(l2)){
                    text = (parseInt(l2*1000-l1))/1000;
                    if (text>0) text = '+'+text;
                }
            }
            if (np.getAttribute('seeking')!==null) text='&hArr;';
            cache_table += '<div id="'+i+'" class="block ' + (np.isError()?' error':(np.isReadyForPlay()?' ready':((np.isEmpty() || np.isError())?'':' wait'))) + (i==0?' center':'') + '"' + style + '>'+text+'</div>';
            if (i==self.selected_cache){
                let l=0,d='';
                if (np.getFirstTime()){
                    l = (np.getInitialLastTime() - np.getFirstTime() + 1)/1000;
                    d = new Date(np.getFirstTime()).toISOString().replace('T','&nbsp;');
                }
                l = isNaN(l) ? 'undefined' : l.toFixed(3);
                let l2 = np.getAttribute('duration')!==null ? ''+parseFloat(np.getAttribute('duration')).toFixed(3) : 'undefined';
                let f = np.isEmpty() ? 'empty' : (np.getAttribute('fullload')!==null ? 'fully loaded' : (np.isError() ? 'error' : (np.getAttribute('loaded')=='100'?'simply loaded':'loading')));
                sel_cache = '<div>[.player'+self.selected_cache+']&nbsp;'+f;
                if (!np.isEmpty()) sel_cache+='<br/>len/dur: '+l+'&nbsp;/&nbsp;'+l2+'&nbsp;sec<br/>&nbsp;&nbsp;&nbsp;Time: '+d+'</div>';
            }
        }
        cache_table+='</div>';

        let req_before = this.getAttribute('reqbefore'); if (req_before===null) req_before='no need'; else req_before = new Date(parseInt(req_before)).toISOString().replace('T','&nbsp;');
        let req_from = this.getAttribute('reqfrom'); if (req_from===null) req_from='no need'; else req_from = new Date(parseInt(req_from)).toISOString().replace('T','&nbsp;');

        let di = this.onDebugInfo();
        this.debuginfo.innerHTML = `
            Status/speed: <span>`+status+` / `+this.speed+`</span><br/>
            &nbsp;Mean block duration: <span>`+this.mean_duration+` ms</span><br/>
            &nbsp;&nbsp;Time: <span>`+playtime+`</span><br/>
            Before: <span>`+req_before+`</span><br/>
            &nbsp;After: <span>`+req_from+`</span><br/>
            `+cache_table+ sel_cache + di;
        let z = this.debuginfo.getElementsByClassName('cachetable')[0].children;
        for (let i=0; i<z.length;i++){
            z[i].addEventListener('click',function(){
                self.selected_cache = this.getAttribute('id');
            });
        }
        this.debuginfo.style.display="block";
        this.update_debug_info_timer = setTimeout(function(){self.updateDebugInfo();},300);
    }
}
CKAddVideoDebug();