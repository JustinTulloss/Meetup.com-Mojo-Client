Meet = {}; //meetup namespace

function StageAssistant () {
}

StageAssistant.prototype.setup = function() {
	this.controller.pushScene("sync");
}
