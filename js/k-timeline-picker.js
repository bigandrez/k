/* 2021, dev mail bigandrez@gmail.com, license type has not been selected yet */

class CTimeLinePicker extends HTMLElement {
    static get observedAttributes() {
        return ['scale','centerutctime','selectutctime','utc']; 
    }
    constructor() {
        super();
        this.event_moved = new Event('moved',{cancelable: false, bubbles: true});
        this.event_moving = new Event('moving',{cancelable: false, bubbles: true});
        this.event_change = new Event('change',{cancelable: false, bubbles: true});
        this.default_scale = 100;
        this.min_frame_width = 18;
        this.min_sec_frame_width = 155;
        this.min_hoursec_width = 57;
        this.min_year_width = 32;
    }
    connectedCallback() {
        let self = this;
        this.addEventListener("mousewheel", function(e) { 
            if (e.wheelDeltaX==0 && e.offsetX < self.getBoundingClientRect().width/2){
                let scale = self.getAttribute('scale');
                scale = scale===null ? self.default_scale : (scale);
                if(e.wheelDelta /120 > 0) {
                    scale = (scale/1.5);
                    let req_frames = self.getAttribute('frames') || 1;
                    if (req_frames>1 && req_frames*frames <= 1/scale)
                        scale = 1 / self.min_frame_width / req_frames;
                    if (req_frames<=1 && 1/scale > self.min_hoursec_width)
                        scale = 1 / self.min_hoursec_width;
                }
                else{
                    let new_scale = (scale*1.5);
                    if (self.min_year_width <= 60*60*24*365*1000 / new_scale)
                        scale = new_scale;
                }
                if (!isNaN(parseInt(self.getAttribute('maxscale'))) && scale>parseInt(self.getAttribute('maxscale')))
                    scale = parseInt(self.getAttribute('maxscale'));
                self.loc_change=true;
                self.setAttribute('scale',scale>1?scale:1);
                self.loc_change=undefined;
            } else {
                let new_time = parseInt(self.getAttribute('centerutctime')||0) + this.one_shift_time*e.wheelDelta/120;
                self.loc_change=true;
                self.setAttribute('centerutctime',new_time);
                self.loc_change=undefined;
            }
            e.stopPropagation();
            e.preventDefault();
            return false;
        });

        let handleMouseUp = function(event){
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleMouseMove);
            delete self.down_mouse_posx, self.down_mouse_time;
            setTimeout(function(){self.dispatchEvent(self.event_moved);},0);
        };
        let handleMouseMove = function(event){
            let scale = parseFloat(self.getAttribute('scale')||100);
            let pixel_shift = event.pageX - self.down_mouse_posx;
            let new_time = parseInt(self.down_mouse_time - pixel_shift*scale);
            self.loc_change=true;
            self.setAttribute('centerutctime',new_time);
            self.loc_change=undefined;
        };
        this.addEventListener('mousedown', function(event){
            self.down_mouse_posx = event.pageX;
            self.down_mouse_time = parseInt(self.getAttribute('centerutctime'));
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('mousemove', handleMouseMove);
            setTimeout(function(){self.dispatchEvent(self.event_moving);},0);
            return event.preventDefault ? event.preventDefault() : event.returnValue = false;
        })
        window.addEventListener("resize", function() {
            self.update();
        }, false);

        this.min_year_width = this.textWidth('0000');
        this.min_months_width = this.textWidth('M');
        this.min_year_month_width = this.textWidth('2020 May')+6;
        this.min_day_width = this.textWidth('00')+10;
        this.min_day_hour_width = this.textWidth('22 Feb 2020')+2;
        this.min_hour_width = this.textWidth('00:00');
        this.min_hoursec_width = this.textWidth('00:00:00');
        this.min_frame_width = this.textWidth('00')+2;
        this.min_sec_frame_width = this.textWidth('22 Feb 2020, 00:00:000')+2;

        this.default_scale = 60*60*24*365/(this.min_year_width*1);

        this.style.display="block";
        this.style.height="45px";
        this.shadow = this.attachShadow({mode: 'open'});
        this.shadow.innerHTML = CTimeLinePicker.css;
//        $(this).css('position','relative').css('overflow','hidden');
        let databar = this.getAttribute('databar')!==null ? ' databar':'';
        this.shadow.innerHTML += '<div class="body"'+databar+'><div class="centerpos"></div><div class="wrap"><div class="twrap"><div class="range"></div><div class="databar"></div><table><tr><td>123</td></tr><tr></tr></table></div></div></div>';
        this.centerpos= this.shadow.querySelector('.centerpos');
        this.wrap= this.shadow.querySelector('.wrap');
        this.twrap= this.shadow.querySelector('.twrap');
        this.table = this.shadow.querySelector('table');
        this.databar = this.shadow.querySelector('.databar');;
        this.line1 = this.shadow.querySelector('table tr:first-child');
        this.line2 = this.shadow.querySelector('table tr:last-child');
        if (this.getAttribute('scale')===null || this.getAttribute('centerutctime')===null){
            this.loc_change=true;
            if (this.getAttribute('scale')===null)
                this.setAttribute('scale', this.default_scale); // 50 pixels per year
            if (this.getAttribute('centerutctime')===null)
                this.setAttribute('centerutctime', (Date.now()));
            this.loc_change=false;
        }
        else
            this.attributeChangedCallback();
    }
    disconnectedCallback(){
        delete this.event_moved;
        delete this.event_moving;
    }
    attributeChangedCallback(name, oldValue, newValue) {
        let self = this;
        if (!this.table) {
            if (name=='scale')
                this.default_scale = parseInt(newValue);
            return;
        }
        if (name=='centerutctime'){
            let shift_time = parseInt(oldValue) - parseInt(newValue);
            let scale = parseInt(self.getAttribute('scale')||100);
            if (this.down_mouse_posx!==undefined)
                self.update(!self.loc_change);
            else
                if (shift_time!=0 && !isNaN(shift_time))
                    this.moveAnimate(parseInt(shift_time / scale),!self.loc_change);
                else this.update(!this.loc_change);
            return;
        }
        if (name=='scale'){
            this.scaleAnimate(parseFloat(oldValue),!self.loc_change);
            return;
        }
        this.update(!self.loc_change);
    }
    scaleAnimate(oldscale, from_out){
        let self = this;

        if (this.scale_timer) return;
        this.scale_timer = setTimeout(function(){
            let scale = parseFloat(self.getAttribute('scale')||100);
            scale = oldscale/scale;

            self.table.style.transform='scaleX(1)';
            let animate = self.table.parentElement.parentElement.animate([{ transform: 'scaleX('+(scale || 1)+')' }], 100);
            animate.onfinish = function() {
                self.table.parentElement.parentElement.style.transform = 'scaleX(1)';
                self.update(from_out);
                delete self.scale_timer;
            }
        },0);
    }
    moveAnimate(animate_move_pixels, from_out){
        let self = this;
        this.last_move_pixels = animate_move_pixels + (this.last_move_pixels!==undefined?this.last_move_pixels:0);
        if (this.animate_move_pixels!==undefined) 
            return;
        this.animate_move_pixels = this.last_move_pixels;
        delete self.last_move_pixels;

        let animate = this.twrap.animate([{ left: this.animate_move_pixels+'px' }], 100);
        animate.onfinish = function() {
            if (self.last_move_pixels!==undefined){
                delete self.animate_move_pixels;
                setTimeout(function(){
                    self.moveAnimate(0);
                },0);
                return;
            }
            delete self.animate_move_pixels;
            self.twrap.style.left = 0;
            self.update(from_out);
        };
    }
    divider(val,arr){
        for (let i=0; i<arr.length; i++)
            if (val>arr[i]) return arr[i];
        return val;
    }
    static get RANGES(){
        return;
    }
    update(from_out){
        let self = this;
        if (!this.table) return;
        let screen_width = this.getBoundingClientRect().width;
//        if (this.update_timer) clearTimeout(this.update_timer);
//        if (!screen_width) {this.update_timer = setTimeout(function(){delete self.update_timer;self.update();},500);return;}

        const scale = parseFloat(this.getAttribute('scale')||0);
        const MAX_PIXELS_PER_YEAR = parseInt(60*60*24*365*1000 / scale);
        const MAX_PIXELS_PER_MONTH = parseInt(60*60*24*31*1000 / scale);
        const PIXELS_PER_DAY = 60*60*24*1000 / scale;
        const PIXELS_PER_HOUR = 60*60*1000 / scale;
        const PIXELS_PER_MINUTE = 60*1000 / scale;
        const PIXELS_PER_SECOND = 1000 / scale;

        const MONTHS_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
//            let MONTHS_NAMES = ['January','February','March','April','May','June','Jule','August','September','October','November','December'];

        this.one_shift_time = 1000;

        // Seconds per pixel
        let centerutctime = parseInt(this.getAttribute('centerutctime') || Date.now());
        if (centerutctime===undefined || scale===undefined) return;

        let left_time = parseInt(centerutctime - scale*screen_width*1.5);
        let right_time = parseInt(centerutctime + scale*screen_width*1.5);

        let left_date = new Date(left_time+this.getTimeOffset());
        let right_date = new Date(right_time+this.getTimeOffset());

        // as "only years" mode
        let only_years_mode = this.min_months_width >= MAX_PIXELS_PER_MONTH;
        let seconds_frame_mode = this.min_sec_frame_width < PIXELS_PER_SECOND;
        let day_seconds_mode = seconds_frame_mode ? false : this.min_hoursec_width < PIXELS_PER_HOUR/2;
        let day_hour_mode = seconds_frame_mode||day_seconds_mode ? false : this.min_day_hour_width <= PIXELS_PER_DAY;
        let months_day_mode = seconds_frame_mode||day_hour_mode||day_seconds_mode ? false : this.min_year_month_width < MAX_PIXELS_PER_MONTH;
        let year_months_mode = seconds_frame_mode||months_day_mode||day_hour_mode||day_seconds_mode ? false : (this.min_months_width < MAX_PIXELS_PER_MONTH);

        let left_day_time = this.roundDayDown(left_time);
        let right_day_time = this.roundDayUp(right_time);

        let line1 = '', line2='';
        this.ranges = [];
        if (only_years_mode || year_months_mode){
            let prev_pos = 0, sum_milli_seconds=0;
            let i = new Date(left_date);
            do{
                sum_milli_seconds+=this.getYearSeconds(i.getFullYear());
                let next_pos = sum_milli_seconds/scale;
                let ys = Math.round(next_pos - prev_pos);

                let text = i.getFullYear();
                if (screen_width/2 < 365*24*60*60*1000 / scale){
                    let g = Math.ceil(365*24*60*60*1000 / scale / screen_width)+1;
                    let text2=text;text='';
                    for (let ii=0;ii<g;ii++)
                        text += '<div>'+text2+'</div>';
                }

                line1 += '<td style="min-width:'+ys+'px;max-width:'+ys+'px"'+(only_years_mode?' rowspan=2':'')+(year_months_mode?' colspan=12':'')+'><div>'+text+'</div></td>';
                this.ranges.push([i.getTime(),ys]);
                prev_pos += ys;
            } while (i<right_date && i.setFullYear(i.getFullYear()+1));
            let left_day = new Date(left_date.getFullYear(),0,1,0,0,0);
            this.table_left_time = left_day.getTime();
            this.one_shift_time = 60*60*24*365*1000;
        }

        if (year_months_mode){
            this.ranges = [];
            let prev_pos=0,month_seconds_sum=0;
            let i = new Date(left_date.getFullYear(), 0,1,0,0,0);
            this.table_left_time = i.getTime() - this.getTimeOffset();;
            let e = new Date(right_date.getFullYear()+1, 0,1,0,0,0);
            do{
                month_seconds_sum += this.getMonthSeconds(i.getFullYear(),i.getMonth());
                let next_pos = month_seconds_sum/scale;
                let ms = Math.round(next_pos - prev_pos);
                line2 += '<td style="min-width:'+ms+'px;max-width:'+ms+'px";"><div>'+MONTHS_NAMES[i.getMonth()]+'</div></td>';
                this.ranges.push([i.getTime(),ms]);
                prev_pos += ms;
            } while (i<e && i.setMonth(i.getMonth()+1));
            this.one_shift_time = 60*60*24*30*1000;
        }

        if (months_day_mode){
            let prev_pos=0,msilliseconds_sum=0;
            let i = new Date(left_date.getFullYear(), left_date.getMonth(),1,0,0,0);
            this.table_left_time = i.getTime()-this.getTimeOffset();
            let e = new Date(right_date.getFullYear(), right_date.getMonth()+1,1,0,0,0);
            do{
                let dim = this.getDaysInMonth(i.getFullYear(),i.getMonth());
                let month_divider = this.divider(MAX_PIXELS_PER_MONTH / this.min_day_width, [dim,10,6,4,3,2,1]);
                let text = MONTHS_NAMES[i.getMonth()]+' '+i.getFullYear();
                if (screen_width/2 - this.min_day_hour_width < MAX_PIXELS_PER_MONTH){
                    let g = Math.ceil(MAX_PIXELS_PER_MONTH / screen_width)+1;
                    let text2=text;text='';
                    for (let ii=0;ii<g;ii++)
                        text += '<div>'+text2+'</div>';
                }
                line1 += '<td colspan='+month_divider+'><div>'+text+'</div></td>';
                let d = new Date(i); let de = new Date(d.getFullYear(),d.getMonth()+1,1,0,0,0);
                let divs_count=month_divider;
                do{
                    divs_count--;
                    let next_pos = (d.getTime() - this.getTimeOffset() - this.table_left_time + parseInt(dim/month_divider)*24*60*60*1000 )/scale;
                    if (!divs_count)
                        next_pos = (i.getTime() - this.getTimeOffset() + dim*24*60*60*1000 - this.table_left_time)/scale;
                    let dw = Math.round(next_pos - prev_pos);
                    let style = ' style="width:'+dw+'px;min-width:'+dw+'px;max-width:'+dw+'px;"';
                    line2 += '<td'+style+'><div>'+d.getDate()+'</div></td>';
                    this.ranges.push([d.getTime(),dw]);
                    prev_pos += dw;
                    if (!divs_count) break;
                    d.setDate(d.getDate()+parseInt(dim/month_divider));
                } while (d<de);
                i.setMonth(i.getMonth()+1);
            } while (i<e);
            this.one_shift_time = 60*60*24*1000;
        }

        if (day_hour_mode){
            let day_divider = this.divider(PIXELS_PER_DAY / this.min_hour_width, [24,12,8,6,4,3,2,1]);
            let prev_pos=0;
            let i = new Date(left_date);
            do{
                let text = (i.getDate())+' '+MONTHS_NAMES[i.getMonth()]+' '+i.getFullYear();

                if (screen_width/2 < 24*60*60*1000 / scale){
                    let g = Math.ceil(24*60*60*1000 / scale / screen_width)+1;
                    let text2=text;text='';
                    for (let ii=0;ii<g;ii++)
                        text += '<div>'+text2+'</div>';
                }

                line1 += '<td colspan='+day_divider+'><div>'+text+'</div></td>';
                for (let hour = 0; hour<24; hour+= 24 / day_divider){
                    let next_pos = (i.getTime() - left_date.getTime()+(hour+24 / day_divider)*60*60*1000)/scale;
                    let full_width = Math.round(next_pos - prev_pos);
                    line2 += '<td style="width:'+full_width+'px;min-width:'+full_width+'px;max-width:'+full_width+'px;">&nbsp;<div>'+hour+':00</div></td>';
                    this.ranges.push([i.getTime() + hour*60*60*1000,full_width]);
                    prev_pos += full_width;
                }
            } while (i<right_date && i.setDate(i.getDate()+1));
            let left_day = new Date(left_date.getFullYear(),left_date.getMonth(),left_date.getDate(),0,0,0);
            this.table_left_time = left_day.getTime() - this.getTimeOffset();;
            this.one_shift_time = parseInt(60*60*24*1000/day_divider);
        }

        if (day_seconds_mode){

            let day_width = 60*60*24*1000 / scale;
            let hour_divider = this.divider(day_width / this.min_hoursec_width / 24,[60*60,60*30,60*12,60*10,60*6,60*4,60*3,60*2,60,30,20,15,12,10,6,5,4,3,2,1]);

            let left_sec_time = parseInt(left_time / (60*60*1000/hour_divider)) * (60*60*1000/hour_divider);
            let r = parseInt(right_time / (60*60*1000/hour_divider)) * (60*60*1000/hour_divider) + 60*60*1000/hour_divider;
            let right_sec_time = r == right_time + 60*60*1000/hour_divider ?  right_time : r;

            let border_mode = (new Date(left_sec_time+this.getTimeOffset())).getDate() != (new Date(right_sec_time+this.getTimeOffset())).getDate();
            let seconds_before_border = left_day_time + 60*60*24*1000 - left_sec_time;
            let full_width = parseInt((right_sec_time - left_sec_time) / scale);
            let cols_count = parseInt((right_sec_time - left_sec_time) / (60*60*1000/hour_divider));
            let cols_count_before = parseInt(seconds_before_border / (60*60*1000/hour_divider));
            let col_width = 60*60*1000/hour_divider / scale;

            let ldate = new Date(left_sec_time+this.getTimeOffset());
            let rdate = new Date(right_sec_time+this.getTimeOffset());
            let style = '';
            let style_first = 'text-align:right;';
            let t = parseInt((right_sec_time - left_sec_time - seconds_before_border)/scale);
            let style_last = 'text-align:left;';

            let text='',text2 = ldate.getDate()+' '+MONTHS_NAMES[ldate.getMonth()]+' '+ldate.getFullYear();
            for (let ii=0;ii<3;ii++) text += '<div>'+text2+'</div>';
            let text4='',text3 = rdate.getDate()+' '+MONTHS_NAMES[rdate.getMonth()]+' '+rdate.getFullYear();
            for (let ii=0;ii<3;ii++) text4+= '<div>'+text3+'</div>';

            if (!border_mode)
                line1 = '<td colspan='+cols_count+' style="'+style+'"><div style="text-align:center;">'+text+'</div></td>';
            else
                line1 = '<td colspan='+cols_count_before+' style="'+style_first+'"><div>'+text+'</div></td>'+
                '<td colspan='+(cols_count-cols_count_before)+' style="'+style_last+'"><div>'+text4+'</div></td>';
            let has_seconds = false;
            let prev_pos=0;
            for (let utc = left_sec_time; utc < right_sec_time; utc += 60*60*1000/hour_divider){
                let next_pos = ((utc - left_sec_time + 60*60*1000/hour_divider)/(60*60*1000)) * PIXELS_PER_HOUR;
                let hw = Math.round(next_pos - prev_pos);
                let d = new Date(utc); d = new Date(utc+this.getTimeOffset());
                if (!has_seconds) has_seconds = d.getSeconds()>0;
                let datetext = d.getHours();
                if (col_width > this.min_hour_width) datetext += ':'+(d.getMinutes()<10?'0':'')+d.getMinutes();
                if (has_seconds) datetext += '<sup>:'+(d.getSeconds()<10?'0':'')+d.getSeconds()+'</sup>';
                line2 += '<td style="width:'+hw+'px;min-width:'+hw+'px;max-width:'+hw+'px;">&nbsp;<div>'+datetext+'</div></td>';
                this.ranges.push([utc,hw]);
                prev_pos += hw;
            }
            this.table_left_time = left_sec_time;

            this.one_shift_time = parseInt(60*60*1000/hour_divider);
        }
    
        if (seconds_frame_mode){
            let req_frames = parseInt(this.getAttribute('frames') || 1);
            let max_frames = parseInt(PIXELS_PER_SECOND / this.min_frame_width);
            let frame_divider;
            for (frame_divider = max_frames; frame_divider>1; frame_divider--)
                if (!(req_frames % frame_divider)) break;
            let prev_pos=0;
            let left_seconds = new Date(left_date.getFullYear(), left_date.getMonth(), left_date.getDate(), left_date.getHours(), left_date.getMinutes(), left_date.getSeconds());
            let right_seconds = new Date(right_date.getFullYear(), right_date.getMonth(), right_date.getDate(), right_date.getHours(), right_date.getMinutes(), right_date.getSeconds());
            let i = new Date(left_seconds);
            do{
                let text = i.toLocaleTimeString() + ', ' + i.getDate()+' '+MONTHS_NAMES[i.getMonth()]+' '+i.getFullYear();
                if (screen_width < 1000 / scale){
                    let g = Math.ceil(1000 / scale / screen_width);
                    let text2=text;text='';
                    for (let ii=0;ii<g;ii++)
                        text += '<div>'+text2+'</div>';
                }
                line1 += '<td colspan='+frame_divider+'><div>'+text+'</div></td>';
                for (let frame = 0; frame < req_frames; frame += req_frames / frame_divider){
                    let next_pos = PIXELS_PER_SECOND*((i.getTime()-left_seconds.getTime())/1000 + 1/frame_divider+frame/req_frames);
                    let ws = Math.round(next_pos - prev_pos);
                    line2 += '<td style="width:'+ws+'px;min-width:'+ws+'px;max-width:'+ws+'px;">&nbsp;<div>'+frame+'</div></td>';
                    this.ranges.push([i.getTime() + 1000 / req_frames * frame,ws]);
                    prev_pos += ws;
                }
            } while (i<right_seconds && i.setSeconds(i.getSeconds()+1));
            this.table_left_time = left_seconds.getTime() - this.getTimeOffset();
            this.one_shift_time = parseInt(1000/frame_divider);
        }

        this.line1.innerHTML = line1;
        this.line2.innerHTML = line2;

        let wrap_shift_left = Math.floor(-screen_width/2);
        this.wrap.style.left = ''+wrap_shift_left+'px';
        let twrap_shift_left = - wrap_shift_left - Math.round((centerutctime - this.table_left_time)/scale - parseInt(screen_width/2));
        this.twrap.style.marginLeft = ''+twrap_shift_left+'px';
        this.centerpos.style.left = Math.round(screen_width/2-20.5)+'px';
        this.summary_shift = wrap_shift_left + twrap_shift_left;

        while (this.getAttribute('databar')!==null && typeof this.ongetranges === "function"){
            let ranges = this.ongetranges(parseInt(centerutctime - scale*screen_width/2), parseInt(centerutctime + scale*screen_width/2));
            this.databar.innerHTML = '';
            if (ranges.length<2) {
                this.databar.innerHTML = '';
                break;
            }
            let start, end;
            for (let i=0; i<ranges.times.length; i++){
                if (ranges.times[i]<this.table_left_time) start=i;
                if (Math.abs(ranges.durations[i]) >= right_time && end===undefined) {end=i+1;break;}
            }
            if (start===undefined) start=0;
            if (end===undefined) end=ranges.times.length;
            let timeline_html='';

            let prev_pos=0;
            for (let i=start; i<end; i++){
                let st = parseInt((ranges.times[i] - this.table_left_time)/scale);
                let et = parseInt((ranges.times[i] + Math.abs(ranges.durations[i]) - this.table_left_time)/scale);
                let w = et - st;
                let n = st - prev_pos;
                timeline_html += '<div '+(ranges.durations[i]<0?'e ':'')+'style="width:'+w+'px; margin-left:'+n+'px;"></div>';
                prev_pos = et;
            }
            this.databar.innerHTML = timeline_html;
            break;
        }
        if (this.getAttribute('selectutctime')!==null){
            let selectutctime = parseInt(this.getAttribute('selectutctime'));
            let lt = centerutctime > selectutctime ? selectutctime : centerutctime;
            let mar_left = parseInt(this.getBoundingClientRect().width/2 - (centerutctime - lt)/scale) - wrap_shift_left - twrap_shift_left;
            let range_width = (centerutctime > selectutctime ? centerutctime - selectutctime : selectutctime - centerutctime)/scale;
            this.shadow.querySelector('.range').style.width = ''+range_width+'px';
            this.shadow.querySelector('.range').style.marginLeft = ''+mar_left+'px';
            this.shadow.querySelector('.range').style.display = 'block';
        } else
            this.shadow.querySelector('.range').style.display = 'none';
        if (!from_out){
            setTimeout(function(){self.dispatchEvent(self.event_change);},0);
        }
    }
    getTimeOffset(){
        let utc = this.getAttribute('utc');
        if (utc!==null) return (new Date().getTimezoneOffset())*60*1000+parseInt(utc)*60*60*1000;
        return 0;
    }

    roundDayDown(utctime){
        let d = new Date(utctime+this.getTimeOffset());
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime() - this.getTimeOffset();
    }
    roundDayUp(utctime){
        let d = new Date(utctime+this.getTimeOffset());
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()+1, 0, 0, 0).getTime() - this.getTimeOffset();
    }
    getYearSeconds(year) {
        let utc1 = Date.UTC(year, 0, 1, 0, 0, 0);
        let utc2 = Date.UTC(year+1, 0, 1, 0, 0, 0);
        return parseInt((utc2 - utc1) );
    }
    getMonthSeconds(year, month) {
        let utc1 = Date.UTC(year, month, 1, 0, 0, 0);
        let utc2 = Date.UTC(year, month+1, 1, 0, 0, 0);
        return parseInt((utc2 - utc1) );
    }
    getDaysInMonth(year, month) {
        let utc1 = Date.UTC(year, month, 1, 0, 0, 0);
        let utc2 = Date.UTC(year, month+1, 1, 0, 0, 0);
        return parseInt((utc2 - utc1) / 1000 / 24/60/60);
    }
    textWidth(text, fontSize, fontFamily){
        let el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.float = "left";
        el.style.whiteSpace = 'nowrap';
        el.style.visibility = 'hidden';
        el.style.fontSize = fontSize ? fontSize : this.style.fontSize;
        el.style.fontFamily = fontFamily ? fontFamily : this.style.fontFamily;
        el.innerHTML = text;
        el = this.appendChild(el);
        let w = el.offsetWidth;
        el.parentNode.removeChild(el);
        return w;
    }
    getRanges() {
        return this.ranges!==undefined ? this.ranges : [];
    }
    getSummaryShift() {
        return this.summary_shift ? this.summary_shift : 0;
    }
    static get css() {
        return `<style>
table{border-spacing:0px;height:100%;min-height:3em;color:inherit;}
table tr td{padding:0;}
.body:not(:not([databar])) table tr:first-child td{padding-bottom:3px;}
.body:not([databar]) .databar{display:none;}
.databar{height:5px;position:absolute;min-width:100%;display:block;top:1em;z-index:20;line-height:0px;white-space:nowrap;background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACAQMAAABIeJ9nAAAAAXNSR0IB2cksfwAAAAZQTFRF////AAAAVcLTfgAAAAJ0Uk5TZmbh5cV0AAAADElEQVR4nGNwYGgAAAFEAME6ehxWAAAAAElFTkSuQmCC);}
table tr:first-child td{box-shadow:1px 0px 0px white;vertical-align:middle;height:1em;}
.body:not([databar]) table tr:first-child td{height:1.2em;}
table tr:first-child td:first-child > div{text-align:right;}
table tr:first-child td:last-child > div{text-align:left;}
table tr:first-child td > div{padding:0px 3px;text-align:center;height:1.1em;overflow:hidden;white-space:nowrap;display:flex;flex-direction:row;align-content:space-between;justify-content:space-between;}
table tr:last-child td > div{height:1.2em;word-break:break-all;overflow:hidden;width:100%;position:absolute;text-align:center;top:4px;left:-50%;}
table tr:last-child td{height:min-content;text-align:left;vertical-align:middle;position:relative;}
table tr:last-child td.year{border-left:1px solid gray;border-top:2px solid gray;}
.body:not([databar]) table tr:last-child td:not(.year){border-top:2px solid gray;}
table tr:last-child td:not(.year):before{margin-left:0px;content:'';width:0px;height:5px;border-left:1px solid;position:absolute;top:0;border-left-color:inherit;}
table tr:last-child td.odd{background-color:#80808040;}
table td sup{vertical-align:baseline;}
.centerpos{width:41px;background:none;background:linear-gradient(90deg, #0000, #f888 40%,#f888 45%, #f88f 49%,#0000 50%, #f88f 51%, #f888 55%, #f888 60%, #0000);height:100%;position:absolute;left:calc(50% - 20.5px);top:0;z-index:10;}
.centerpos div{margin:0 auto;width:1px;height:100%;background:red;}
*{-moz-user-select:none;-webkit-user-select:none;-ms-user-select:none;user-select:none;}
.body{position:relative;overflow:hidden;width:100%;height:100%;}
.wrap{position:absolute;left:-50%;height:100%;right:-50%;}
.twrap{position:absolute;height:100%;}
.databar > [e]{background-color:black;}
.databar > :not([e]){box-shadow:-1px 0 1px black;}
.databar > div{height:5px;height:4px;background-color:white;margin-top:1px;display:inline-block;}
.databar > div.e{background-color:white;}
.range{height:40px;background-color:#f888;margin-top:1px;position:absolute;}
</style>`;
    }

}
window.customElements.define('k-timeline-picker', CTimeLinePicker);

