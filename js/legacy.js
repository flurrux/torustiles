	/*
	const createRectImageData = (ctx, width, height, getPixelAt) => {
		width = Math.ceil(width);
		height = Math.ceil(height);
		const imageData = ctx.createImageData(width, height);

		let counter = 0;
		for (let y = 0; y < height; y++){
			for (let x = 0; x < width; x++){
				const pixelData = getPixelAt(x, y);
				for (let i = 0; i < pixelData.length; i++){
					imageData.data[counter] = pixelData[i];
					counter++;
				}
			}
		}
		return imageData;
	};
	
	const getTileAtPosition = (tiles, position) => {
		return tiles.find(tile => isTileAtPosition(tile, position.x, position.y));
	};
	const isTilePositionComponentAt = (tilePositionComponent, target, loopSize) => {
		target = loopNum(0, loopSize, target);
		tilePositionComponent = loopNum(0, loopSize, tilePositionComponent);
		return tilePositionComponent === target;
	};
	const isTileAtPosition = (tile, x, y) => {
		const tilePosition = tile.position;
		if (x !== null && !isTilePositionComponentAt(tilePosition.x, x, horizontalSize)) {
			return false;
		}
		if (y !== null && !isTilePositionComponentAt(tilePosition.y, y, verticalSize)) {
			return false;
		}
		return true;
	};
	const getSolveMoves = (solveMethod, tiles) => {
		tiles = tiles.map(tile => {
			return {
				initialPosition: tile.initialPosition.copy(),
				position: tile.position.copy()
			}
		});
		const getTileAtInitialPosition = (tiles, x, y) => {
			return tiles.find(tile => isTileAtPosition(tile, x, y));
		};

		if (solveMethod === "naive") {
			const moves = [];
			const dragTileTo = (tile, direction, target) => {

				const prop = direction === "horizontal" ? "x" : "y";
				const loopSize = direction === "horizontal" ? horizontalSize : verticalSize;
				if (isTilePositionComponentAt(tile.position[prop], target, loopSize)) {
					return;
				}

				const delta = target - (direction === "horizontal" ? tile.position.x : tile.position.y);
				const rowIndex = direction === "horizontal" ? tile.position.y : tile.position.x;
				const move = {
					direction: direction,
					stride: delta,
					rowIndex: rowIndex
				};
				moves.push(move);
				tile.position[prop] = target;
			};
			const lastX = horizontalSize - 1;
			for (let a = 0; a < verticalSize - 1; a++) {
				for (let b = 0; b < horizontalSize - 1; b++) {
					const targetPoint1 = new Vector2D(lastX, a);
					const tile = getTileAtInitialPosition(tiles, targetPoint1.x, targetPoint1.y);
					if (isTileAtPosition(tile, targetPoint1.x, targetPoint1.y)) {
						continue;
					}
					if (isTileAtPosition(tile, null, targetPoint1.y)) {

					}
					else {
						dragTileTo(tile, "horizontal", targetPoint1.x);
						dragTileTo(tile, "vertical", targetPoint1.y);
						dragTileTo(tile, "horizontal", lastX - 1);
					}
				}
			}
		}
	};
	
	
	//tiles ###
	let tiles = [];
	app.getTiles = () => tiles;
	const getTileByLabel = tileLabel => {
		return tiles.find(tile => tile.label === tileLabel);
	};
	const getLabelByTile = (tile) => {
		return (tile.initialPosition.y * horizontalSize + tile.initialPosition.x + 1).toString();
	};
	const initTiles = () => {
		tiles = [];
		for (let a = 0; a < horizontalSize; a++) {
			for (let b = 0; b < verticalSize; b++) {
				const [x, y] = [a, b];
				const tile = new Tile({
					imageData: null,
					position: new Vector2D(x, y),
					initialPosition: new Vector2D(x, y)
				});
				tile.label = getLabelByTile(tile);
				tiles.push(tile);
			}
		}
	};

	//dragging
	{
		if (config.draggingMethod === "animate transition") {
			const dragger = new CarykhTileDragger(canvas);
		}
		else if (config.draggingMethod === "move and snap") {
			//leaning and snap to smaller center rect
			{
				let dragging = false;
				let mouseDownTileSpacePoint = null;
				let prevMouseDragSpacePoint = null;

				//leaning
				let leaningRowTiles = null;
				let leaningRowsInitialPositions = null;
				const nonLeanZoneSize = 0.34;
				const setupLeaning = (tileCoo) => {
					leaningRowTiles = tiles.filter(tile => {
						return isTilePositionComponentAt(tile.position.x, tileCoo.x, horizontalSize) ||
							isTilePositionComponentAt(tile.position.y, tileCoo.y, verticalSize);
					});
					leaningRowsInitialPositions = new Map();
					leaningRowTiles.forEach(tile => leaningRowsInitialPositions.set(tile, tile.position.copy()));
				};
				const restoreLeaningTiles = () => leaningRowTiles.forEach(tile => tile.position = leaningRowsInitialPositions.get(tile));
				const updateLeaning = (centerTileCoo, dragCellSpacePoint) => {
					//center rect
					const absPoint = dragCellSpacePoint.transformedComponents(Math.abs);
					if (absPoint.x < nonLeanZoneSize && absPoint.y < nonLeanZoneSize) {
						return;
					}
					const leanDirection = absPoint.x > absPoint.y ? "horizontal" : "vertical";
					const leanVector = leanDirection === "horizontal" ?
						new Vector2D(dragCellSpacePoint.x, 0) :
						new Vector2D(0, dragCellSpacePoint.y);
					const tileFilter = leanDirection === "horizontal" ?
						(tile => isTileAtPosition(tile, null, centerTileCoo.y)) :
						(tile => isTileAtPosition(tile, centerTileCoo.x, null));
					const curLeaningTiles = leaningRowTiles.filter(tileFilter);
					curLeaningTiles.forEach(tile => tile.position = leaningRowsInitialPositions.get(tile).plus(leanVector));
				};

				const onDragStart = e => {
					//prevent multi-touch for now
					if (dragging) {
						return;
					}
					dragging = true;
					const tileSpacePoint = e.localMousePoint.toTileSpace();
					const tileCoo = tileSpacePoint.quantized(1);
					mouseDownTileSpacePoint = tileCoo.plus(new Vector2D(0.5, 0.5));
					prevMouseDragSpacePoint = mouseDownTileSpacePoint.vectorTo(tileSpacePoint);
					setupLeaning(tileCoo);
					updateLeaning(tileCoo, prevMouseDragSpacePoint);
					requestRender();
				};
				const onDrag = e => {
					const prevMouseDragGridPoint = prevMouseDragSpacePoint.rounded();
					const curMouseDragSpacePoint = mouseDownTileSpacePoint.vectorTo(e.localMousePoint.toTileSpace());
					const curMouseDragGridPoint = curMouseDragSpacePoint.rounded();
					const centerTileCoo = mouseDownTileSpacePoint.plus(curMouseDragGridPoint).quantized(1);
					const gridDelta = prevMouseDragGridPoint.vectorTo(curMouseDragGridPoint);
					const dragCellSpacePoint = curMouseDragGridPoint.vectorTo(curMouseDragSpacePoint);

					restoreLeaningTiles();

					if (!(gridDelta.x === 0 && gridDelta.y === 0)) {
						const gridIntersections = getLineToGridLineIntersections(...[prevMouseDragSpacePoint, curMouseDragSpacePoint].map(point => point.plus(new Vector2D(0.5, 0.5))));
						const gridDeltaSign = gridDelta.transformedComponents(Math.sign);
						let movementCenterTile = mouseDownTileSpacePoint.plus(prevMouseDragGridPoint).quantized(1);
						for (let intersectionEntry of gridIntersections) {
							const moveStride = intersectionEntry.lineDirection === "vertical" ?
								new Vector2D(gridDeltaSign.x, 0) : new Vector2D(0, gridDeltaSign.y);
							const tileFilter = intersectionEntry.lineDirection === "vertical" ?
								(tile => isTilePositionComponentAt(tile.position.y, movementCenterTile.y, verticalSize)) :
								(tile => isTilePositionComponentAt(tile.position.x, movementCenterTile.x, horizontalSize));
							tiles.filter(tileFilter).forEach(tile => tile.position = tile.position.plus(moveStride));
							movementCenterTile = movementCenterTile.plus(moveStride);
						}
						setupLeaning(centerTileCoo);
					}

					updateLeaning(centerTileCoo, dragCellSpacePoint);
					requestRender();

					prevMouseDragSpacePoint = curMouseDragSpacePoint;
				};
				const onDragEnd = e => {
					dragging = false;
					restoreLeaningTiles();
					requestRender();
				};

				const dragger = new DragHelper(canvas);
				dragger.onDragStart = onDragStart;
				dragger.onDrag = onDrag;
				dragger.onDragEnd = onDragEnd;
			}
		}
		else if (config.draggingMethod === "spring snap") {
			new SpringSnapTileDragger(canvas);
		}

		//move rows by raw delta pixels
		{
			let dragging = false;
			let initialRowCoordinateMap = null;
			let dragDirection = "none";
			let getDraggedSquares = null;
			
			let mouseDownCanvasPoint = null;
			let mouseDownScreenPoint = null;
			let mouseDownGridPoint = null;

			canvas.addEventListener("mousedown", e => {
				mouseDownCanvasPoint = new Vector2D(e.offsetX, e.offsetY);
				mouseDownScreenPoint = new Vector2D(e.screenX, e.screenY);
				dragging = true;			
			});
			document.addEventListener("mousemove", e => {
				if (!dragging){
					return;
				}
				
				const currentMouseScreenPoint = new Vector2D(e.screenX, e.screenY);
				if (dragDirection === "none"){
					const dragVector = Vector2D.vectorBetween(mouseDownScreenPoint, currentMouseScreenPoint);
					const dragDistance = Math.hypot(dragVector.x, dragVector.y);
					if (dragDistance > 10){
						dragDirection = Math.abs(dragVector.x) > Math.abs(dragVector.y) ? "horizontal" : "vertical";
						mouseDownGridPoint = Vector2D.quantized(Vector2D.divide(mouseDownCanvasPoint, tileSize), 1);
						initialRowCoordinateMap = new Map();
						getDraggedSquares = dragDirection === "horizontal" ? 
							(() => getTilesInRow("horizontal", mouseDownGridPoint.y)) : 
							(() => getTilesInRow("vertical", mouseDownGridPoint.x));
						getDraggedSquares().forEach(square => initialRowCoordinateMap.set(square, square.position.copy()));
					}
					else {
						return;
					}
				}

				let mousePositionDelta = Vector2D.vectorBetween(mouseDownScreenPoint, currentMouseScreenPoint);
				mousePositionDelta = Vector2D.divide(mousePositionDelta, tileSize);
				//["x", "y"].forEach(prop => deltaCoo[prop] = Math.round(deltaCoo[prop]));
				const movedProp = dragDirection === "horizontal" ? "x" : "y";
				getDraggedSquares().forEach(square => {
					square.position[movedProp] = initialRowCoordinateMap.get(square)[movedProp] + mousePositionDelta[movedProp]
				});
				requestRender();
			});
			document.addEventListener("mouseup", e => {
				if (!dragging){
					return;
				}
				dragging = false;
				dragDirection = "none";
				snapTilesToGrid(getDraggedSquares());
				requestRender();
			});
		}

		//move touched tile to mouse point
		{
			const updateRowPosition = (touchTilePosition, rowTiles, mousePoint) => {
				const centerTile = rowTiles[0];
				const centerPoint = Vector2D.add(touchTilePosition, new Vector2D(0.5, 0.5));
				const deltaVector = Vector2D.vectorBetween(centerPoint, mousePoint);
				const biggerProp = Math.abs(deltaVector.x) > Math.abs(deltaVector.y) ? "x" : "y";
				const shift = new Vector2D();
				shift[biggerProp] = Math.sign(deltaVector[biggerProp]) * Math.log(Math.abs(deltaVector[biggerProp]) + 1) * 1;
				centerTile.position = Vector2D.add(touchTilePosition, shift);
				requestRender();
			};
			
			const getCoordinateData = e => {
				const mousePoint = new Vector2D(e.offsetX, e.offsetY);
				const scaledMousePoint = Vector2D.divide(mousePoint, tileSize);
				const quantizedMousePoint = Vector2D.quantized(scaledMousePoint, 1);
				return {
					tileSpaceMousePoint: scaledMousePoint,
					tileSpaceMousePointQuantized: quantizedMousePoint
				};
			};
			
			const updateRowDragging = (leaningData, prevTilePoint, curTilePoint) => {
				
				if (prevTilePoint !== null){
					const intersectionValues = getLineToGridLineIntersections(prevTilePoint, curTilePoint);
					if (intersectionValues.length > 0){
						leaningData.rowTiles.forEach(tile => tile.position = leaningData.initialPositionsMap.get(tile));
						const dragVector = Vector2D.vectorBetween(prevTilePoint, curTilePoint);
						const dragSigns = [Math.sign(dragVector.x), Math.sign(dragVector.y)];
						let dragRefPosition = Vector2D.quantized(prevTilePoint.copy(), 1);
						for (let intersectionVal of intersectionValues){
							const intersectionDirection = intersectionVal.lineDirection === "horizontal" ? "vertical" : "horizontal";
							const dragStride = intersectionDirection === "horizontal" ? new Vector2D(dragSigns[0], 0) : new Vector2D(0, dragSigns[1]);
							const rowIndex = intersectionDirection === "horizontal" ? dragRefPosition.y : dragRefPosition.x;
							const draggedTiles = getTilesInRow(intersectionDirection, rowIndex);
							draggedTiles.forEach(tile => tile.position = Vector2D.add(tile.position, dragStride));
						}
						leaningData = null;
					}
				}
				
				const curTilePointSnapped = Vector2D.quantized(curTilePoint, 1);
				const touchedTile = getTileAtPosition(curTilePointSnapped);
				const curTileCenter = Vector2D.add(curTilePointSnapped, new Vector2D(0.5, 0.5));
				let rawLeanVector = Vector2D.vectorBetween(curTileCenter, curTilePoint);
				const leanDirection = Math.abs(rawLeanVector.x) > Math.abs(rawLeanVector.y) ? "horizontal" : "vertical";
				const leanProp = leanDirection === "horizontal" ? "x" : "y";
				const leanVal = rawLeanVector[leanProp];
				const leanVector = new Vector2D();
				leanVector[leanProp] = Math.sign(leanVal) * Math.log(Math.abs(leanVal) + 1) * 0.5;
				
				
				//leaningData: { direction, centerTile, rowTiles, initialPositionsMap }
				const leaningChanged = leaningData === null || leaningData.direction !== leanDirection || leaningData.centerTile !== touchedTile;
				if (leaningChanged){
					//restore positions
					if (leaningData !== null){
						leaningData.rowTiles.forEach(tile => tile.position = leaningData.initialPositionsMap.get(tile));
					}

					const rowIndex = leanDirection === "horizontal" ? curTilePointSnapped.y : curTilePointSnapped.x;
					const rowTiles = getTilesInRow(leanDirection, rowIndex);
					const initialPositionsMap = new Map();
					rowTiles.forEach(tile => initialPositionsMap.set(tile, tile.position.copy()));
					leaningData = {
						direction: leanDirection,
						centerTile: touchedTile,
						rowTiles: rowTiles,
						initialPositionsMap: initialPositionsMap
					};
				}
				//apply leaning
				leaningData.rowTiles.forEach(tile => {
					tile.position = Vector2D.add(leaningData.initialPositionsMap.get(tile), leanVector);
				});

				return leaningData;
			};


			let dragging = false;
			let prevTileSpaceMousePoint = null;
			let leaningData = null;

			canvas.addEventListener("mousedown", e => {
				dragging = true;
				const cooData = getCoordinateData(e);
				leaningData = updateRowDragging(leaningData, null, cooData.tileSpaceMousePoint);
				requestRender();
			});
			document.addEventListener("mousemove", e => {
				if (!dragging){
					return;
				}
				const cooData = getCoordinateData(e);
				leaningData = updateRowDragging(leaningData, prevTileSpaceMousePoint, cooData.tileSpaceMousePoint);
				prevTileSpaceMousePoint = cooData.tileSpaceMousePoint;
				requestRender();
			});
			document.addEventListener("mouseup", e => {
				if (!dragging){
					return;
				}
				snapTilesToGrid(tiles);
				dragging = false;
				requestRender();
			});
		}

		//leaning plus animation
		{
			//tileSpace -> downscaled and unsnapped
			//tileGrid -> downscaled and snapped
			//gridSpace -> tileSpace point relative to a given point (in this case the mouseDownPoint)

			//state, "not dragging", "start leaning", "leaning", "moving", "end leaning" 
			let state = "not dragging";
			let mouseDownTileSpacePoint = null;
			let prevMouseDragSpacePoint = null;
			let currentMoveAnimation = null;

			//leaning ###	
			let leaningRowsInitialPositions = null;
			let leaningRowTiles = null;
			const setupLeaningData = (tilePosition) => {
				leaningRowTiles = tiles.filter(tile => tile.position.x === tilePosition.x || tile.position.y === tilePosition.y);
				leaningRowsInitialPositions = new Map();
				for (let tile of leaningRowTiles){
					leaningRowsInitialPositions.set(tile, tile.position.copy());
				}
			};
			const updateLeaning = (dragSpacePoint) => {
				const dragGridPoint = dragSpacePoint.quantized(1);
				const dragCellPoint = dragGridPoint.vectorTo(dragSpacePoint);
				const dragTileCoo = mouseDownTileSpacePoint.plus(dragGridPoint).quantized(1);

				const leanDirection = Math.abs(dragCellPoint.x) > Math.abs(dragCellPoint.y) ? "horizontal" : "vertical";
				let leanValue = leanDirection === "horizontal" ? dragCellPoint.x : dragCellPoint.y;
				const nonLeanZoneSize = 0.15;
				leanValue = Math.abs(leanValue) < nonLeanZoneSize ? 0 : Math.sign(leanValue) * (Math.abs(leanValue) - nonLeanZoneSize)
				leanValue = Math.sign(leanValue) * Math.log(Math.abs(leanValue) + 1) * 0.5;
				
				const leanVector = leanDirection === "horizontal" ? new Vector2D(leanValue, 0) : new Vector2D(0, leanValue);
				
				const leanTileFilter = leanDirection === "horizontal" ? 
					(tile => tile.position.y === dragTileCoo.y) : 
					(tile => tile.position.x === dragTileCoo.x);
				const leanTiles = leaningRowTiles.filter(leanTileFilter);
				leaningRowTiles.forEach(tile => {
					tile.position = leaningRowsInitialPositions.get(tile);
					if (leanTileFilter(tile)){
						tile.position = tile.position.plus(leanVector);
					}
				});
			};

			
			const moveRowWithAnimation = (direction, rowIndex, stride, animate) => {
				const strideVector = direction === "horizontal" ? new Vector2D(stride, 0) : new Vector2D(0, stride);
				const rowTiles = getTilesInRow(direction, rowIndex);
				if (animate){
					const initialPositionsMap = new Map();
					rowTiles.forEach(tile => initialPositionsMap.set(tile, tile.position.copy()));
					const anim = new Animation(100, 
						progress => {
							progress = easing.fastInSlowOut(progress);
							rowTiles.forEach(tile => {
								tile.position = Vector2D.add(initialPositionsMap.get(tile), Vector2D.multiply(strideVector, progress))
							});
							requestRender();
						}, 
						() => {
							rowTiles.forEach(tile => {
								tile.position = Vector2D.add(initialPositionsMap.get(tile), strideVector)
							});
							const animIndex = moveAnimations.indexOf(anim);
							if (animIndex >= 0){
								moveAnimations.splice(animIndex, 1);
							}
						}
					);
				}
				else {
					rowTiles.forEach(tile => {
						tile.position = Vector2D.add(tile.position, strideVector)
					});
				}
			};
			

			const dragger = new DragHelper(canvas);
			dragger.onDragStart = e => {
				const mouseDownTileCoo = e.localMousePoint.divide(tileSize).quantized(1);
				mouseDownTileSpacePoint = mouseDownTileCoo.plus(new Vector2D(0.5, 0.5));
				prevMouseDragSpacePoint = mouseDownTileSpacePoint.vectorTo(e.localMousePoint.divide(tileSize));
				setupLeaningData(mouseDownTileCoo);
				updateLeaning(prevMouseDragSpacePoint);
				requestRender();
			};
			dragger.onDrag = e => {
				
				const prevMouseDragGridPoint = prevMouseDragSpacePoint.quantized(1);
				const curMouseTileSpacePoint = e.localMousePoint.divide(tileSize);
				const curMouseDragSpacePoint = mouseDownTileSpacePoint.vectorTo(curMouseTileSpacePoint);
				const curMouseDragGridPoint = curMouseDragSpacePoint.quantized(1);
				const gridDelta = prevMouseDragGridPoint.vectorTo(curMouseDragGridPoint);
				
				if (gridDelta.x !== 0 || gridDelta.y !== 0){
					if (currentMoveAnimation !== null){
						currentMoveAnimation.skip();
					}
					const useAnimation = !(gridDelta.x !== 0 && gridDelta.y !== 0);
					for (let a = 0; a < 2; a++){
						const direction = ["horizontal", "vertical"][a];
						const prop = ["x", "y"][a];
						const orthoProp = ["y", "x"][a];
						const stride = curMouseGridPoint[prop] - prevMouseGridPoint[prop];
						const rowIndex = prevMouseGridPoint[orthoProp];
						if (stride !== 0){
							moveRowWithAnimation(direction, rowIndex, stride, useAnimation);
						}
						prevMouseGridPoint[prop] += stride;
					}
					setupLeaningData(mouseDownTileCoo);
				}

				//leaning
				updateLeaning(curMouseDragSpacePoint);

				requestRender();
				prevMouseDragSpacePoint = curMouseDragSpacePoint;
			};
		}
	}
	*/