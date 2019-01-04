CanvasRenderingContext2D.prototype.fillCircle = function (x, y, radius) {
	this.beginPath();
	this.arc(x, y, radius, 0, Math.PI * 2);
	this.fill();
};
CanvasRenderingContext2D.prototype.strokeLine = function (point1, point2) {
	this.beginPath();
	this.moveTo(point1.x, point1.y);
	this.lineTo(point2.x, point2.y);
	this.stroke();
};
CanvasRenderingContext2D.prototype.strokePolyline = function (polyline) {
	this.beginPath();
	for (let a = 0; a < polyline.length; a++) {
		this[a === 0 ? "moveTo" : "lineTo"](polyline[a].x, polyline[a].y);
	}
	this.stroke();
};
CanvasRenderingContext2D.prototype.scaleUniformly = function (scale) {
	this.scale(scale, scale);
};
