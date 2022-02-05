class Rect2D {
	constructor(minX, minY, maxX, maxY){
		this.minX = minX;
		this.minY = minY;
		this.maxX = maxX;
		this.maxY = maxY;
	}
	get width(){
		return this.maxX - this.minX;
	}
	get height(){
		return this.maxY - this.minY;
	}
	get x(){
		return this.minX;
	}
	get y(){
		return this.minY;
	}
}