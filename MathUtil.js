{
	const MathUtil = {};
	window.MathUtil = MathUtil;

	MathUtil.getLineToGridLineIntersections = (startPoint, endPoint) => {
		const intersectionValues = [];
		for (let dimIndex = 0; dimIndex < 2; dimIndex++){
			
			const vecProp = ["x", "y"][dimIndex];
			const lineDirection = ["vertical", "horizontal"][dimIndex];
			const pos1 = startPoint[vecProp];
			const pos2 = endPoint[vecProp];

			const vec1 = new Vector2D();
			vec1[vecProp] = pos1;
			const vec2 = new Vector2D();
			vec2[vecProp] = pos2;

			if (Math.floor(pos1) !== Math.floor(pos2)){
				const minPos = Math.min(pos1, pos2);
				const maxPos = Math.max(pos1, pos2);
				const length = maxPos - minPos;
				const firstTickInside = Math.ceil(minPos);
				const lastTickInside = Math.floor(maxPos);
				const strideSign = Math.sign(pos2 - pos1);
				const enclosedTickNum = lastTickInside - firstTickInside;
				for (let tickPos = firstTickInside; tickPos <= lastTickInside; tickPos++){
					let normalizedPointPosition = (tickPos - minPos) / length;
					if (strideSign < 0){
						normalizedPointPosition = 1 - normalizedPointPosition;
					}
					intersectionValues.push({
						lineDirection: lineDirection,
						lineIndex: tickPos, 
						normalizedPointPosition: normalizedPointPosition
					});
				}
			}
		}
		intersectionValues.sort((a, b) => a.normalizedPointPosition - b.normalizedPointPosition);
		return intersectionValues;
	};

	MathUtil.lerp = (from, to, val) => {
		return from + (to - from) * val;
	};
	MathUtil.clamp = (min, max, val) => {
		if (val < min){
			return min;
		}
		else if (val > max){
			return max;
		}
		return val;
	};
	MathUtil.loopNum = (minVal, maxVal, val) => {
		const localVal = val - minVal;
		const interval = maxVal - minVal;
		const mod = localVal % interval;
		let localLooped = 0;
		if (mod === 0){
			localLooped = 0;
		}
		else if (val >= 0){
			localLooped = mod;
		}
		else {
			return localLooped = interval + (val % interval);
		}
		return minVal + localLooped;
	};
	MathUtil.snapToGrid = (cellSize, val) => {
		return MathUtil.inverseTransformAndSnapToGrid(cellSize, val) * cellSize;
	};
	MathUtil.inverseTransformAndSnapToGrid = (cellSize, val) => {
		return Math.round(val / cellSize);
	};
	MathUtil.quantizeNum = (quant, val) => {
		return Math.floor(val / quant) * quant;
	};
}