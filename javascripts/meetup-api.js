/*
 *** Javascript Client for the Meetup API ***
 * This is an example for how to access data from the Meetup site
 * for client-side applications. It uses jQuery to handle the AJAX requests
 * (note that to avoid conflicts, the jQuery object has been aliased to j$)
 * and create callback functions so that you can make the request from outside
 * domains. You can hot-link this script from your site, or use your own
 * client code.
 *
 * For demo purposes, links that are signed by meetup.com do not require an API key;
 * for all other general API usage, a valid key must be provided with all requests.
 *
 * To get more details on request types, formats, parameters, and responses, see
 * the detailed API documentation at meetup.com.
 *
 */

urlprefix = 'http://api.meetup.com/'
GROUPS_PREFIX = 'groups/'
EVENTS_PREFIX = 'events/'
MEMBERS_PREFIX = 'members/'
PHOTOS_PREFIX = 'photos/'
RSVPS_PREFIX = 'rsvps/'
TOPICS_PREFIX = 'topics/'
CITIES_PREFIX = 'cities/'

/* Client constructor must be initialized with a valid API key as an argument */
var MeetupApiClient = function(key){ this.init(key) }
MeetupApiClient.prototype.init = function(key){   this.key = key  }

MeetupApiClient.prototype.callrpc = function callRpc(call_type, params, callback){
    var url = '?callback=meetupCallbackFunction&'

    params.key = this.key
    params.format = 'json'
    /* required for demo applications */
    if(params.sig){
        delete(params.key)
        delete(params.format)
    }
    //url = url.substring(0,url.length-1)
    var my = this;
    meetupCallbackFunction = function(json) { 
        my.nextPageUrl = json.meta.next;
        callback(json)
    };

    var query = $H(params).toQueryString();
    url = urlprefix + call_type + url + query;
    Mojo.loadScriptWithCallback(url, Mojo.doNothing);
}

MeetupApiClient.prototype.nextPage = function(callback) {
    var my = this;
    meetupCallbackFunction = function(json) { 
        my.nextPageUrl = json.meta.next;
        callback(json)
    };

    Mojo.loadScriptWithCallback(my.nextPageUrl, Mojo.doNothing);
}

/* These methods will make a request using the provided parameters, and execute the specified callback function
 * when the result is returned */
MeetupApiClient.prototype.get_groups =  function(params, callback){
    this.callrpc(GROUPS_PREFIX, params, callback)
}

MeetupApiClient.prototype.get_events =  function(params,callback){
    this.callrpc(EVENTS_PREFIX, params, callback)
}

MeetupApiClient.prototype.get_members =  function(params,callback){
    this.callrpc(MEMBERS_PREFIX, params, callback)
}
MeetupApiClient.prototype.get_rsvps =  function(params,callback){
    this.callrpc(RSVPS_PREFIX, params, callback)
}

MeetupApiClient.prototype.get_topics =  function(params,callback){
    this.callrpc(TOPICS_PREFIX, params, callback)
}

MeetupApiClient.prototype.get_photos =  function(params,callback){
    this.callrpc(PHOTOS_PREFIX, params, callback)
}

MeetupApiClient.prototype.get_cities =  function(params,callback){
    this.callrpc(CITIES_PREFIX, params, callback)
}
