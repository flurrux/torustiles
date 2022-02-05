{
	const [snapToGrid, loopNum, inverseTransformAndSnapToGrid, clamp, quantizeNum] = [
		MathUtil.snapToGrid, MathUtil.loopNum, MathUtil.inverseTransformAndSnapToGrid, MathUtil.clamp, MathUtil.quantizeNum
	];
	const Vector2D = class {
		constructor(x, y){
			this.x = x || 0;
			this.y = y || 0;
		}

		copy(){
			return new Vector2D(this.x, this.y);
		}
		set(otherVector){
			this.x = otherVector.x;
			this.y = otherVector.y;
		}
		equals(b){
			return this.x === b.x && this.y === b.y;
		}
		getMagnitude(){
			return Math.hypot(this.x, this.y);
		}

		vectorTo(b){
			return Vector2D.vectorBetween(this, b);
		}
		directionTo(b){
			return Vector2D.normalized(this.vectorTo(b));
		}
		distanceTo(b){
			return this.vectorTo(b).getMagnitude();
		}

		transformComponents(transformFunc){
			this.x = transformFunc(this.x);
			this.y = transformFunc(this.y);
			return this;
		}
		transformedComponents(transformFunc){
			return this.copy().transformComponents(transformFunc);
		}

		plus(b){
			return Vector2D.add(this, b);
		}
		add(b){
			this.x += b.x;
			this.y += b.y;
			return this;
		}

		minus(b){
			return Vector2D.subtract(this, b);
		}
		subtract(b){
			this.x -= b.x;
			this.y -= b.y;
			return this;
		}

		multiply(s){
			if (typeof(s) === "number"){
				return Vector2D.multiply(this, s);
			}
			else if (s.constructor && s.constructor === Vector2D){
				return Vector2D.multiplyComponents(this, s);
			}
		}
		scale(s){
			this.x *= s;
			this.y *= s;
			return this;
		}

		divide(d){
			return Vector2D.divide(this, d);
		}
		inverseScale(d){
			this.x /= d;
			this.y /= d;
			return this;
		}

		normalize(){
			const mag = this.getMagnitude();
			this.inverseScale(mag);
			return this;
		}
		normalized(){
			return this.copy().normalize();
		}

		snappedToGrid(cellSize){
			return Vector2D.snappedToGrid(this, cellSize);
		}
		snapToGrid(cellSize){
			this.transformComponents(c => snapToGrid(cellSize, x));
			return this;
		}

		loopedOverRect(rect){
			return this.copy().loopOverRect(rect);
		}
		loopOverRect(rect){
			this.x = loopNum(rect.minX, rect.maxX, this.x);
			this.y = loopNum(rect.minY, rect.maxY, this.y);
			return this;
		}

		quantized(quant){
			quant = quant || 1;
			return Vector2D.quantized(this, quant);
		}
		quantize(quant){
			this.transformComponents(c => inverseTransformAndSnapToGrid(quant, c));
			return this;
		}

		rounded(){
			return new Vector2D(Math.round(this.x), Math.round(this.y));
		}
		round(){
			this.transformComponents(Math.round);
			return this;
		}



		static add(a, b){
			return new Vector2D(a.x + b.x, a.y + b.y);
		}
		static subtract(a, b){
			return new Vector2D(a.x - b.x, a.y - b.y);
		}
		static multiply(a, s){
			return new Vector2D(a.x * s, a.y * s);
		}
		static multiplyComponents(a, b){
			return new Vector2D(a.x * b.x, a.y * b.y);
		}
		static divide(a, d){
			return new Vector2D(a.x / d, a.y / d);
		}
		static magnitudeOf(vector){
			return Math.hypot(vector.x, vector.y);
		}
		static vectorBetween(a, b){
			return Vector2D.subtract(b, a);
		}
		static normalized(vector){
			return Vector2D.divide(vector, Vector2D.magnitudeOf(vector));
		}
		static clampedToRect(vector, rect){
			return new Vector2D(clamp(rect.minX, rect.maxX, vector.x), clamp(rect.minY, rect.maxY, vector.y));
		}
		static loopedOverRect(vector, rect){
			return new Vector2D(loopNum(rect.minX, rect.maxX, vector.x), loopNum(rect.minY, rect.maxY, vector.y));
		}
		static snappedToGrid(vector, cellSize){
			cellSize = cellSize || 1;
			return new Vector2D(snapToGrid(cellSize, vector.x), snapToGrid(cellSize, vector.y));
		}
		static inverseTransformAndSnapToGrid(vector, cellSize){
			return new Vector2D(inverseTransformAndSnapToGrid(cellSize, vector.x), inverseTransformAndSnapToGrid(cellSize, vector.y))
		}
		static quantized(vector, quant){
			return new Vector2D(quantizeNum(quant, vector.x), quantizeNum(quant, vector.y));
		}
	}
	window.Vector2D = Vector2D;
}