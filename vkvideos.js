/*
 *  VK Videos plugin for Movian Media Center
 *
 *  Copyright (C) 2015-2018 Buksa, lprot
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var page = require('showtime/page');
var service = require('showtime/service');
var settings = require('showtime/settings');
var http = require('showtime/http');
var string = require('native/string');
var plugin = JSON.parse(Plugin.manifest);
var logo = Plugin.path + "logo.png";

RichText = function(x) {
    this.str = x.toString();
}

RichText.prototype.toRichString = function(x) {
    return this.str;
}

var API = 'https://api.vk.com/method',
    access_token = '2bdd2fc3bc43ed9d1a6d0c45fe22bc9c86a083d883406adc3f9d77403c85b8df4ba1e63d173ca764deb7c',
    APIver = '5.28';

var blue = '6699CC', orange = 'FFA500', red = 'EE0000', green = '008B45';

function coloredStr(str, color) {
    return '<font color="' + color + '">' + str + '</font>';
}

function setPageHeader(page, title) {
    if (page.metadata) {
        page.metadata.title = title;
        page.metadata.logo = logo;
    }
    page.type = "directory";
    page.contents = "items";
    page.entries = 0;
    page.loading = true;
}

service.create(plugin.title, plugin.id + ":start", 'video', true, logo);

settings.globalSettings(plugin.id, plugin.title, logo, plugin.synopsis);
settings.createBool("Safe_Search", "Adult Search", 0, function(v) {
    service.adult = v;
});

new page.Route(plugin.id + ":moreFromTheOwner:(.*)", function(page, id) {
    setPageHeader(page, 'Videos of the user with ID: ' + id);

    function loader() {
        page.loading = true;
        var json = JSON.parse(http.request(API + '/video.get', {
            args: {
                uid: id,
                count: 200,
                offset: page.entries,
                adult: service.adult,
                access_token: access_token,
                v: APIver
            }
        }));

        page.loading = false;
        for (var i in json.response.items) {
            var item = page.appendItem(plugin.id + ":play:" + escape(json.response.items[i].player) + ':' + encodeURIComponent(json.response.items[i].title), "video", {
                title: string.entityDecode(unescape(json.response.items[i].title)),
                icon: json.response.items[i].photo_320,
                duration: json.response.items[i].duration,
                timestamp: json.response.items[i].adding_date,
                description: new RichText(coloredStr('Title: ', orange) +
                    string.entityDecode(unescape(json.response.items[i].title)) +
                    (json.response.items[i].description ? '\n' + coloredStr('Description: ', orange) + json.response.items[i].description : ''))
            });
            page.entries++;
        }
        if (page.entries == json.response.count) return false;
        return true;
    };
    loader();
    page.paginator = loader;
    page.loading = false;
});


function getUrlArgs(url) {
    var link = url;
    var result = {
        url: link,
        args: {}
    };
    var args = {};
    if (link.indexOf('?') != -1) {
        var args_tmp = url.slice(url.indexOf('?') + 1);
        args_tmp = args_tmp.split('&');
        for (var i in args_tmp) {
            var arg = args_tmp[i];
            var arg_tmp = arg.split('=');
            args[arg_tmp[0]] = arg_tmp[1];
        }
        link = link.slice(0, link.indexOf('?'));
    }
    result.url = link;
    result.args = args;
    return result;
}

new page.Route(plugin.id + ":play:(.*):(.*)", function(page, url, title) {
    console.log(unescape(url));
    page.loading = true;
    var video = null; 
    var v = http.request(unescape(url)).toString();
    if (v.match(/<div id="video_ext_msg">/)) { //nonembedable link
        var tmp = unescape(url).match(/oid=([\s\S]*?)&id=([\s\S]*?)&/);
        if (tmp)
            v = http.request('https://vk.com/video' + tmp[1] + '_' + tmp[2]).toString();
    }

    //molodejj.tv
    if (v.match(/player.molodejj.tv[^']+/)) {
        url = (/player.molodejj.tv[^']+/.exec(v)).toString();
        v = http.request('http://api.molodejj.tv/tv/pladform.php', {
            args: getUrlArgs(url).args
        })
        video = v.match(/videoURL=([^&]+)/)[1];
    } else if (v.match(/rutube.ru\/(?:.*\/)?([a-f0-9]+)/)) { //rutube.ru
        var id = (/rutube.ru\/(?:.*\/)?([a-f0-9]+)/.exec(v)[1]);
        url = 'http://rutube.ru/api/play/options/' + id + '/?format=json';
        json = JSON.parse(http.request(url));
        video = 'hls:' + json.video_balancer.m3u8;
    } else if (v.match(/megogo.net\/b\/embedplayer\/[^']+/)) { // megogo
        url = (/megogo.net\/b\/embedplayer\/[^']+/.exec(v)).toString()
        v = http.request('http://' + url + '?_stV=', {
            noFollow: 1,
            headers: {
                Referer: 'http://vk.com/video_ext.php?oid=118750968&id=165357066&hash=99b536bd4342f55f'
            }
        })
        v = http.request('http://megogo.net/b/info/', {
            postdata: {
                m: 0,
                h: 'http://vk.com/',
                s: 0,
                i: 96781,
                t: 0,
                //rnd: 9 % 2E09621031023562,
                e: 0,
                p: 0,
                l: ''
            }
        })
        video = 'hls:' + v.match(/<src>(.+?)manifest.f4m<\/src>/)[1] + 'playlist.m3u8'
    } else if (v.match(/"hls":"[\s\S]*?"/)) { // vk hls
        video = v.match(/"hls":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
    } else if (v.match(/"url720":"[\s\S]*?"/)) { // vk 720p
        video = v.match(/"url720":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
    } else if (v.match(/"url480":"[\s\S]*?"/)) { // vk 480p
        video = v.match(/"url480":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
    } else if (v.match(/"url360":"[\s\S]*?"/)) { // vk 360p
        video = v.match(/"url360":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
    }else if (v.match(/"url240":"[\s\S]*?"/)) { //vk 240p
        video = v.match(/"url240":"([\s\S]*?)"/)[1].replace(/\\\//g, '/');
    } else if (v.match(/<iframe id="video_player"([\s\S]*?)<\/iframe>/)) { // old api
        var link = v.match(/<iframe id="video_player"([\s\S]*?)<\/iframe>/)[1].match(/src="([\s\S]*?)"/)[1];
        page.redirect('youtube:video:' + escape(link));
    } else if (v.match(/youtube/)) { // youtube
        page.redirect('youtube:video:' + v.match(/\?v\=([\S\s]*?)"/)[1]);
    } else if (v.match(/vimeo/)) { // vimeo
        page.redirect('vimeo:video:' + unescape(url).match(/video\/([\S\s]*?)\?/)[1]);
    } else if (v.match(/"url":"/)) { // coub.com
        video = v.match(/"url"\:"([\S\s]*?)"/)[1];
    } 
    page.loading = false;
    if (video) {
        page.type = "video";
        page.source = "videoparams:" + JSON.stringify({
            title: decodeURIComponent(title),
            no_fs_scan: true,
            canonicalUrl: plugin.id + ":play:" + url + ":" + title,
            sources: [{
                url: video
            }],
            no_subtitle_scan: true
        });
    } else {
        var error = v.match(/<div class="light_cry_dog"><\/div>([\s\S]*?)<\/div>/);
        if (error)
            page.error(string.entityDecode(error[1].replace(/(<([^>]+)>)/ig, '').replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ')));
        else {
            console.log(unescape(url));
            page.error("Can't get the link. Sorry :(");
        }
    }
});

function addOptionMoreFromTheOwner(page, item) {
    item.addOptAction("More from this user", function() {
        console.log(plugin.id + ":moreFromTheOwner:" + item.owner_id);
        page.redirect(plugin.id + ":moreFromTheOwner:" + item.owner_id);
    });
}

function scraper(page, query) {
    setPageHeader(page, plugin.title);

    function loader() {
        page.loading = true;
        var json = JSON.parse(http.request(API + '/video.search', {
            args: {
                q: query,
                sort: 0, // 0 - date, 1 - duration, 2 - relevance
                count: 200,
                offset: page.entries,
                adult: service.adult,
                access_token: access_token,
                v: APIver
            }
        }));
        page.loading = false;
        for (var i in json.response.items) {
            var item = page.appendItem(plugin.id + ":play:" + escape(json.response.items[i].player) + ':' + encodeURIComponent(json.response.items[i].title), "video", {
                title: string.entityDecode(unescape(json.response.items[i].title)),
                icon: json.response.items[i].photo_320,
                duration: json.response.items[i].duration,
                timestamp: json.response.items[i].date,
                description: new RichText(coloredStr('Title: ', orange) +
                    string.entityDecode(unescape(json.response.items[i].title)) +
                    (json.response.items[i].description ? '\n' + coloredStr('Description: ', orange) + json.response.items[i].description : ''))
            });

            item.owner_id = json.response.items[i].owner_id;
            addOptionMoreFromTheOwner(page, item); 
            page.entries++;
        }
        return json.response.items.length;
    };
    loader();
    page.paginator = loader;
    page.loading = false;
}

new page.Route(plugin.id + ":start", function(page) {
    setPageHeader(page, plugin.title);
    page.appendItem(plugin.id + ":search:", 'search', {
        title: 'Search in vk.com'
    });
    page.loading = false;
});

new page.Route(plugin.id + ":search:(.*)", function(page, query) {
    scraper(page, query);
});

page.Searcher(plugin.title, logo, function(page, query) {
    scraper(page, query);
});
