{
    const app = new EventTarget();
    window.app = app;

    let config = appSettings.getConfig();
    app.applyConfig = (newConfig) => {
        const oldConfig = config;
        config = newConfig;

        app.dispatchEvent(new CustomEvent("configChanged", {
            detail: {
                prevConfig: oldConfig,
                newConfig: config,
                config: config
            }
        }));

        //gradients
        {
            let gradientUpdateDue = false;
            if (oldConfig === null) {
                gradientUpdateDue = false;
            }
            else {
                const oldGradient = oldConfig.style.gradient;
                const newGradient = newConfig.style.gradient;
                gradientUpdateDue = newGradient !== oldGradient && newGradient !== "simple";
            }
            if (gradientUpdateDue) {
                app.dispatchEvent(new CustomEvent("gradientConfigChanged", {
                    detail: {
                        gradientType: config.style.gradient
                    }
                }));
            }
        }
    };

    //app state control ###
    {
        const gameStates = {
            "not started": "not started",
            "running": "running",
            "paused": "paused",
            "finished": "finished"
        };

        let gameState = "not started";
        Object.defineProperty(app, "gameState", { get: () => gameState });

        let prevGameState = null;
        Object.defineProperty(app, "prevGameState", { get: () => prevGameState });

        const gameStateTransitions = [
            { from: "not started", to: "running", transition: "start" },
            { from: ["not started", "running", "paused", "finished"], to: "not started", transition: "restart" },
            { from: "running", to: "paused", transition: "pause" },
            { from: "paused", to: "running", transition: "resume" },
            { from: "running", to: "finished", transition: "finish" }
        ];
        const getTransitionEntryByStateAndAction = (currentState, desiredTransition) => {
            for (let transitionEntry of gameStateTransitions) {
                const fromStates = Array.isArray(transitionEntry.from) ? transitionEntry.from : [transitionEntry.from];
                if (fromStates.includes(currentState) && transitionEntry.transition === desiredTransition) {
                    return transitionEntry;
                }
            }
        };

        const makeStateTransition = transition => {
            prevGameState = gameState;
            const transitionEntry = getTransitionEntryByStateAndAction(gameState, transition);
            if (!transitionEntry) {
                //console.warn("cannot make desired transition: " + transition);
                return;
            }

            const nextGameState = transitionEntry.to;
            gameState = nextGameState;

            app.dispatchEvent(new CustomEvent("gameStateChanged", {
                detail: {
                    prevGameState: prevGameState,
                    curGameState: nextGameState,
                    transition: transition
                }
            }));
        };

        app.start = () => {
            makeStateTransition("start");
        };
        app.finish = () => {
            makeStateTransition("finish");
        };
        app.pause = () => {
            makeStateTransition("pause");
        };
        app.resume = () => {
            makeStateTransition("resume");
        };
        app.restart = () => {
            makeStateTransition("restart");
        };
        app.isIdle = () => {
            return ["not started", "finished"].includes(gameState);
        };
    }

    //Vector ###
    {
        Vector2D.prototype.signed = function () {
            return this.transformedComponents(c => Math.sign(c));
        };
        Vector2D.prototype.plusHalf = function () {
            return this.transformedComponents(c => c + 0.5);
        };
        Vector2D.prototype.minusHalf = function () {
            return this.transformedComponents(c => c - 0.5);
        };
    }

    const isNumInLoopRange = (loopSize, rangeStart, rangeSize, num) => {
        const rawRangeEnd = rangeStart + rangeSize;
        const loopedRangeEnd = MathUtil.loopNum(0, loopSize, rawRangeEnd);
        if (rangeStart < loopSize - rangeSize) {
            return num >= rangeStart && num <= rawRangeEnd;
        }
        else {
            return num >= rangeStart || num <= loopedRangeEnd;
        }
    };

    //torus groundwork ###
    let torusSpace, tileLayer, makeCoordinateValidOnTorus;
    {
        torusSpace = new EventTarget();
        torusSpace.toroidalPointCount = config.numberOfHorizontalTiles;
        torusSpace.poloidalPointCount = config.numberOfVerticalTiles;
        window.torusSpace = torusSpace;

        const validateTorusSpaceCoordinates = (toroidalCoordinate, poloidalCoordinate) => {
            return [
                MathUtil.loopNum(0, torusSpace.toroidalPointCount, toroidalCoordinate),
                MathUtil.loopNum(0, torusSpace.poloidalPointCount, poloidalCoordinate)
            ];
        };
        torusSpace.getShortestPositionDelta = (point1, point2) => {
            const comps = [["x", torusSpace.toroidalPointCount], ["y", torusSpace.poloidalPointCount]]
                .map(([prop, size]) => {
                    const from = point1[prop];
                    const to = point2[prop];
                    const distance1 = to - from;
                    const distance2 = -Math.sign(distance1) * (size - Math.abs(distance1));
                    return Math.abs(distance1) <= Math.abs(distance2) ? distance1 : distance2;
                });
            return new Vector2D(comps[0], comps[1]);
        };
        makeCoordinateValidOnTorus = vector2d => {
            [vector2d.x, vector2d.y] = validateTorusSpaceCoordinates(vector2d.x, vector2d.y);
        };

        //tile-layer ###
        {
            tileLayer = new EventTarget();
            window.tileLayer = tileLayer;

            const tileManager = tileLayer;

            let publicTiles = null;
            tileManager.getTiles = () => publicTiles.slice();

            let tiles = null;

            const getToroidalPointCount = () => torusSpace.toroidalPointCount;
            const getPoloidalPointCount = () => torusSpace.poloidalPointCount;

            tileManager.init = () => {
                setupTiles();
                initTileMovement();
            };

            const setupTiles = () => {
                tiles = [];
                publicTiles = [];
                const toroidalPointCount = getToroidalPointCount();
                const poloidalPointCount = getPoloidalPointCount();
                for (let a = 0; a < toroidalPointCount; a++) {
                    for (let b = 0; b < poloidalPointCount; b++) {
                        const tile = {
                            initialPosition: new Vector2D(a, b),
                            gridPosition: new Vector2D(a, b),
                            position: new Vector2D(a, b)
                        };
                        tiles.push(tile);

                        const publicTile = {};
                        
                        Object.defineProperties(publicTile, {
                            "initialPosition": { get: () => tile.initialPosition.copy() },
                            "position": { get: () => tile.position.copy() }
                        });

                        /*
                        publicTile.initialPosition = new Vector2D();
                        Object.defineProperties(publicTile.initialPosition, {
                            "x": { get: () => tile.initialPosition.x },
                            "y": { get: () => tile.initialPosition.y }
                        });
                        publicTile.position = new Vector2D();
                        Object.defineProperties(publicTile.position, {
                            "x": { get: () => tile.position.x },
                            "y": { get: () => tile.position.y }
                        });*/

                        publicTiles.push(publicTile);
                    }
                }
            };

            //consistent tile movement ###
            let initTileMovement;
            {
                let rowOffsets = [];
                let prevMovementType = "none";

                initTileMovement = () => {
                    rowOffsets = [];
                    prevMovementType = "none";
                };

                const keepTorusPositionValid = torusPosition => {
                    [torusPosition.x, torusPosition.y] = validateTorusSpaceCoordinates(torusPosition.x, torusPosition.y);
                };

                const applyRowOffsets = () => {
                    if (prevMovementType === "none") {
                        return;
                    }
                    for (let offsetEntry of rowOffsets) {
                        offsetEntry.offset = Math.round(offsetEntry.offset);
                    }
                    const alignProps = prevMovementType === "toroidal" ? ["x", "y"] : ["y", "x"];
                    for (let tile of tiles) {
                        const gridPosition = tile.gridPosition;
                        const rowIndex = gridPosition[alignProps[1]];
                        const currentEntry = rowOffsets.find(entry => entry.index === rowIndex);
                        if (currentEntry !== undefined) {
                            gridPosition[alignProps[0]] += currentEntry.offset;
                            keepTorusPositionValid(gridPosition);
                            tile.position.set(gridPosition);
                        }
                    }
                };

                //movementType: "toroidal" || "poloidal"
                //rowCoordinate: number
                //deltaMovement: number
                tileManager.moveTileRow = (movementType, rowIndex, deltaMovement) => {

                    if (movementType !== prevMovementType) {
                        applyRowOffsets();
                        rowOffsets = [];
                    }

                    //add offset to entry
                    let offsetEntry = rowOffsets.find(offsetEntry => offsetEntry.index === rowIndex);
                    if (offsetEntry === undefined) {
                        offsetEntry = {
                            index: rowIndex,
                            offset: 0
                        };
                        rowOffsets.push(offsetEntry);
                    }
                    const offsetBefore = offsetEntry.offset;
                    offsetEntry.offset += deltaMovement;

                    //apply current offset to tiles
                    const alignProps = movementType === "toroidal" ? ["x", "y"] : ["y", "x"];
                    for (let tile of tiles) {
                        const gridPosition = tile.gridPosition;
                        const orthoMovementGridPosition = gridPosition[alignProps[1]];
                        const currentEntry = rowOffsets.find(entry => entry.index === orthoMovementGridPosition);
                        if (currentEntry !== undefined) {
                            const tilePosition = tile.position;
                            tilePosition[alignProps[0]] = tile.gridPosition[alignProps[0]] + offsetEntry.offset;
                            keepTorusPositionValid(tilePosition);
                        }
                    }

                    prevMovementType = movementType;

                    tileManager.dispatchEvent(new CustomEvent("rowMoved", {
                        detail: {
                            movementType: movementType,
                            rowIndex: rowIndex,
                            deltaMovement: deltaMovement
                        }
                    }));

                    //move count
                    const numberOfMovesDelta = Math.abs(Math.round(offsetEntry.offset) - Math.round(offsetBefore));
                    if (numberOfMovesDelta !== 0) {
                        tileManager.dispatchEvent(new CustomEvent("rowGridPositionChanged", {
                            detail: {
                                movementType: movementType,
                                rowIndex: rowIndex,
                                rowGridPositionDelta: numberOfMovesDelta
                            }
                        }));
                    }
                };
                tileManager.stopTileRowMoving = () => {
                    applyRowOffsets();
                    rowOffsets = [];
                    prevMovementType = "none";

                    tileManager.dispatchEvent(new CustomEvent("rowMovingStopped"));
                    app.requestRender();
                };

                tileManager.getPixelPositionsOfTiles = (pixelsPerTile) => {
                    const tilePixelPositionMap = new Map();
                    for (let a = 0; a < tiles.length; a++){
                        tilePixelPositionMap.set(publicTiles[a], tiles[a].gridPosition.multiply(pixelsPerTile));
                    }
                    const alignProps = prevMovementType === "toroidal" ? ["x", "y"] : ["y", "x"];
                    const offsetVectorDir = new Vector2D();
                    offsetVectorDir[alignProps[0]] = 1;
                    let shiftDirectionSize = prevMovementType === "toroidal" ? getToroidalPointCount() : getPoloidalPointCount();
                    shiftDirectionSize *= pixelsPerTile;
                    for (let rowOffset of rowOffsets){
                        const rowOffsetPixels = Math.round(rowOffset.offset * pixelsPerTile);
                        const offsetVector = offsetVectorDir.multiply(rowOffsetPixels); 
                        const rowIndex = rowOffset.index;
                        publicTiles.filter(tile => tile.position[alignProps[0]] === rowIndex).forEach(tile => {
                            const tilePixelPos = tilePixelPositionMap.get(tile).add(offsetVector);
                            tilePixelPos[alignProps[0]] = MathUtil.loopNum(0, shiftDirectionSize, tilePixelPos[alignProps[0]]);
                        });
                    }
                    
                    return tilePixelPositionMap;
                };
            }

            tileManager.checkIntegrity = () => {
                let integrityPassed = true;

                const misalignedTiles = tiles.filter(tile => tile.position.x % 1 !== 0 || tile.position.y % 1 !== 0);
                if (misalignedTiles.length > 0) {
                    integrityPassed = false;
                    console.warn("found tiles that are not aligned!", misalignedTiles);
                }

                const outOfBoardTiles = tiles.filter(tile => {
                    return tile.position.x < 0 || tile.position.x > getToroidalPointCount() ||
                        tile.position.y < 0 || tile.position.y > getPoloidalPointCount();
                });
                if (outOfBoardTiles.length > 0) {
                    integrityPassed = false;
                    console.warn("found tiles that are out of bounds!", outOfBoardTiles);
                }

                const stackedTiles = tiles.filter(tile => {
                    return tiles.some(otherTile => {
                        if (tile === otherTile) {
                            return;
                        }
                        return tile.position.equals(otherTile.position);
                    });
                });
                if (stackedTiles.length > 0) {
                    integrityPassed = false;
                    console.warn("found tiles on top of each other", stackedTiles);
                }

                if (integrityPassed) {
                    console.log("all tiles are ok!");
                }
            };
            tileManager.areTileGridPositionsInInitialState = () => {
                return tiles.every(tile => tile.gridPosition.equals(tile.initialPosition));
            };
            tileManager.areGridTilePositionsRelativeToEachOtherAsInitially = () => {
                for (let a = 0; a < tiles.length - 1; a++) {
                    const tile1 = tiles[a];
                    const tile2 = tiles[a + 1];
                    const initialRelativePosition = tile1.initialPosition.vectorTo(tile2.initialPosition);
                    const currentRelativePosition = tile1.gridPosition.vectorTo(tile2.gridPosition);
                    if (!currentRelativePosition.equals(initialRelativePosition)) {
                        return false;
                    }
                }
                return true;
            };

            tileManager.getTileAtPoint = torusPoint => {
                const toroidalPointCount = getToroidalPointCount();
                const poloidalPointCount = getPoloidalPointCount();
                const tileIndex = tiles.findIndex(tile => {
                    return 	isNumInLoopRange(toroidalPointCount, tile.position.x, 1, torusPoint.x) &&
                            isNumInLoopRange(poloidalPointCount, tile.position.y, 1, torusPoint.y);
                });
                return publicTiles[tileIndex];
            };

            tileManager.performRandomMoves = (numberOfMoves) => {
                const toroidalPointCount = getToroidalPointCount();
                const poloidalPointCount = getPoloidalPointCount();
                for (let a = 0; a < numberOfMoves; a++) {
                    const rowDirection = Math.random() > 0.5 ? "toroidal" : "poloidal";
                    const maxIndex = rowDirection === "toroidal" ? poloidalPointCount : toroidalPointCount;
                    let rowIndex = Math.floor(Math.random() * maxIndex);
                    if (rowIndex >= maxIndex) {
                        rowIndex = maxIndex;
                    }
                    const rowSize = rowDirection === "toroidal" ? toroidalPointCount : poloidalPointCount;
                    const maxStride = rowSize - 1;
                    const stride = 1 + Math.floor(Math.random() * (maxStride - 1));
                    const positionProps = rowDirection === "toroidal" ? ["x", "y"] : ["y", "x"];
                    const rowTiles = tiles.filter(tile => tile.position[positionProps[1]] === rowIndex);
                    for (let tile of rowTiles) {
                        const moveProp = positionProps[0];
                        let positionComp = tile.position[moveProp] + stride;
                        positionComp = MathUtil.loopNum(0, rowSize, positionComp);
                        tile.position[moveProp] = positionComp;
                        tile.gridPosition[moveProp] = positionComp;
                    }
                }
            };
            tileManager.setTilePositions = tilePositions => {
                //validate tilePositions
                tilePositions.forEach(makeCoordinateValidOnTorus);
                tilePositions.forEach(vector => vector.transformComponents(Math.round));
                for (let a = 2; a < tilePositions.length; a++){
                    const positionToCheck = tilePositions[a];
                    for (let b = 0; b < a; b++){
                        const comparedPosition = tilePositions[b];
                        if (comparedPosition === undefined){
                            continue;
                        }
                        if (positionToCheck.equals(comparedPosition)){
                            tilePositions[a] = undefined;
                            break;
                        }
                    }
                }

                //insert missing positions
                for (let a = 0; a < getToroidalPointCount(); a++){
                    for (let b = 0; b < getPoloidalPointCount(); b++){
                        const foundTile = tilePositions.find(vec => vec.x === a && vec.y === b);
                        if (foundTile){
                            continue;
                        }
                        let insertionIndex = tilePositions.findIndex(vec => vec === undefined);
                        tilePositions[insertionIndex] = new Vector2D(a, b);
                    }
                }

                for (let a = 0; a < tiles.length; a++){
                    tiles[a].position.set(tilePositions[a]);
                    tiles[a].gridPosition.set(tilePositions[a]);
                }
            };

            torusSpace.addEventListener("pointCountChanged", () => tileLayer.init());
        }
    }
    app.addEventListener("gameStateChanged", e => {
        if (e.detail.transition === "restart"){
            torusSpace.toroidalPointCount = config.numberOfHorizontalTiles;
            torusSpace.poloidalPointCount = config.numberOfVerticalTiles;
            torusSpace.dispatchEvent(new CustomEvent("pointCountChanged"));
        }
    });
    tileLayer.init();

    //canvas, canvas sizing, ctx ###
    let canvas, ctx, getCanvasPixelRatio, resizeCanvas;
    {
        canvas = document.querySelector("canvas");
        ctx = canvas.getContext("2d");
        let canvasPixelRatio = 1;
        getCanvasPixelRatio = () => canvasPixelRatio;

        resizeCanvas = (newWidth, newHeight) => {
            canvasPixelRatio = getPixelRatio(ctx);
            canvas.width = newWidth * canvasPixelRatio;
            canvas.height = newHeight * canvasPixelRatio;
            canvas.style.width = newWidth + "px";
            canvas.style.height = newHeight + "px";

            canvas.dispatchEvent(new CustomEvent("resized", {
                detail: {
                    canvasWidth: newWidth,
                    canvasHeight: newHeight
                }
            }));
        };

        const onCanvasNeedsResize = () => {
            const canvasWrapper = canvas.parentElement;
            canvas.dispatchEvent(new CustomEvent("needsResize", { detail: {
                availableWidth: canvasWrapper.offsetWidth,
                availableHeight: canvasWrapper.offsetHeight
            }}));
        };

        new ResizeObserver(onCanvasNeedsResize).observe(canvas.parentElement);
    }


    //general rendering ###
    let renderComponents, requestRender;
    app.requestRender = () => requestRender();
    {
        renderComponents = [];

        const render = () => {
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const pixelRatio = getCanvasPixelRatio();
            ctx.scale(pixelRatio, pixelRatio);

            for (let renderComponent of renderComponents) {
                renderComponent.render(ctx);
            }

            ctx.restore();
        };

        //request render
        {
            let requestedRender = false;
            requestRender = () => {
                if (requestedRender) {
                    return;
                }
                requestedRender = true;
                window.requestAnimationFrame(() => {
                    render();
                    requestedRender = false;
                });
            };
        }
    }

    //coordinate mapping
    let coordinateMapping;
    {
        coordinateMapping = {};
        coordinateMapping.canvasToTorus = canvasPoint => {
            return canvasPoint;
        };
    }	

    //shape: "rect" ###
    {
        const getTiles = () => tileLayer.getTiles();
        const getWidth = () => torusSpace.toroidalPointCount;
        const getHeight = () => torusSpace.poloidalPointCount;

        const setCanvasSizeForRectShape = () => {
            const [availableWidth, availableHeight] = [canvas.parentElement.offsetWidth, canvas.parentElement.offsetHeight];
            const availableWidthPerHeight = availableWidth / availableHeight;
            const canvasWidthPerHeight = getWidth() / getHeight();
            let canvasWidth, canvasHeight;
            if (canvasWidthPerHeight > availableWidthPerHeight) {
                canvasWidth = availableWidth;
                canvasHeight = availableWidth * (1 / canvasWidthPerHeight);
            }
            else {
                canvasHeight = availableHeight;
                canvasWidth = availableHeight * canvasWidthPerHeight;
            }
            const scale = 0.95;
            canvasWidth = Math.floor(scale * canvasWidth / getWidth()) * getWidth();
            canvasHeight = Math.floor(scale * canvasHeight / getHeight()) * getHeight();

            resizeCanvas(canvasWidth, canvasHeight);
        };
        canvas.addEventListener("needsResize", setCanvasSizeForRectShape);
        torusSpace.addEventListener("pointCountChanged", setCanvasSizeForRectShape);

        let tileSize = 0;
        const updateTileSize = () => tileSize = Math.floor(canvas.width / (getWidth() * getCanvasPixelRatio()));
        canvas.addEventListener("resized", updateTileSize);
        torusSpace.addEventListener("pointCountChanged", updateTileSize);

        coordinateMapping = {
            canvasToTorus: canvasPoint => {
                const torusPoint = canvasPoint.copy();
                torusPoint.scale(1 / tileSize);
                makeCoordinateValidOnTorus(torusPoint);
                return torusPoint;
            }
        };

        //gradient
        let tileGradientMap;
        {
            //general gradient util
            let lerpColors, getRandomCornerColorsByCircle;
            {
                lerpColors = (a, b, t) => a.map((c1, ind) => MathUtil.lerp(c1, b[ind], t));
                const getRandomOrder = (size) => {
                    const order = [];
                    for (let a = 0; a < size; a++){
                        order[a] = a;
                    }
                    const randomOrder = [];
                    for (let a = 0; a < size; a++) {
                        const index = Math.floor(order.length * Math.random());
                        randomOrder.push(order[index]);
                        order.splice(index, 1);
                    }
                    return randomOrder;
                };

                const getColorOnCircle = progress => {
                    const segments = [
                        ["full", "up", "zero"], ["down", "full", "zero"], 
                        ["zero", "full", "up"], ["zero", "down", "full"],
                        ["up", "zero", "full"], ["full", "zero", "down"]
                    ];
                    const segmentIndex = Math.floor(progress * 6);
                    const localProgress = progress % (1/6);
                    const color = segments[segmentIndex].map(entry => {
                        if (entry === "full"){
                            return 1;
                        }
                        else if (entry === "up"){
                            return localProgress;
                        }
                        else if (entry === "down"){
                            return 1 - localProgress;
                        }
                        else {
                            return 0;
                        }
                    });
                    return color.map(c => c * 255);
                };
                const brightenColor = (color, progress) => {
                    return color.map(c => MathUtil.lerp(c, 255, progress));
                };
                const darkenColor = (color, progress) => {
                    return color.map(c => MathUtil.lerp(c, 0, progress));
                };
                getRandomCornerColorsByCircle = () => {
                    const circleOrigin = Math.random();
                    let cornerColors = getRandomOrder(4).map(c => {
                        let circlePosition = circleOrigin + c * 0.25 + MathUtil.lerp(-0.07, 0.07, Math.random());
                        circlePosition = MathUtil.loopNum(0, 1, circlePosition);
                        return getColorOnCircle(circlePosition);
                    });
                    cornerColors = cornerColors.map(color => {
                        color = brightenColor(color, MathUtil.lerp(0.1, 0.6, Math.random()));
                        color = darkenColor(color, MathUtil.lerp(0.15, 0.4, Math.random()));
                        return color;
                    });
                    cornerColors = cornerColors.map(color => [...color, 255]);
                    return cornerColors;
                };

                const getRandomCornerColorsInCube = () => {
                    const padding = 20;
                    const min = padding;
                    const max = 255 - padding;
                    const getRandomVal = () => MathUtil.lerp(min, max, Math.random());
                    const cornerColors = [0, 1, 2, 3].map(index => {
                        return [getRandomVal(), getRandomVal(), getRandomVal()]
                    });

                    //push them apart if they are too close
                    const scatterIterations = 10;
                    for (let a = 0; a < scatterIterations; a++) {
                        const forces = cornerColors.map(val => [0, 0, 0]);
                        for (let b = 0; b < cornerColors.length; b++) {
                            const refPoint = cornerColors[b];
                            let distanceSum = 0;
                            for (let c = b + 1; c < cornerColors.length; c++) {
                                const vector = cornerColors[c].map((val, ind) => {
                                    return refPoint[b] - val;
                                });
                                let distance = Math.hypot(...vector);
                                distanceSum += distance;
                                if (distance === 0) {
                                    vector[0] = 1;
                                }
                                const forceMag = Math.max(0, 50 - distance);
                                vector.forEach((val, ind) => {
                                    forces[b][ind] += forceMag * (val / distance);
                                });
                            }
                            console.log(b, distanceSum / 3);
                        }
                        //apply forces
                        cornerColors.forEach((cornerColor, cornerIndex) => {
                            const force = forces[cornerIndex];
                            cornerColor.forEach((component, componentIndex) => {
                                cornerColor[componentIndex] += force[componentIndex] * 0.1;
                            });
                        });
                    }

                    return cornerColors;
                };
            }

            let getColorVector, scaleColorVector, getColorVectorScaled, addToColorVector;
            {
                getColorVector = (from, to) => {
                    return to.map((toComponent, index) => toComponent - from[index]);
                };
                scaleColorVector = (vec, scale) => {
                    vec.forEach((component, index) => vec[index] = component * scale);
                };
                getColorVectorScaled = (vec, scale) => {
                    const scaled = vec.slice();
                    scaleColorVector(scaled, scale);
                    return scaled;
                };
                addToColorVector = (a, b) => {
                    a.forEach((component, index) => a[index] = component + b[index]);
                };
            }

            //specific gradients, gradient state ###
            let getColorInsideCorners, randomizeColors, getPixelAtNormalizedPoint;
            {
                let cornerColors;
                //cornerColors = [
                //	[117, 166, 244, 255], [159, 117, 244, 255], [172, 229, 126, 255], [229, 168, 126, 255]
                //];
                //cornerColors = [0, 1, 2, 3].map(ind => {
                //	return [Math.random() * 255, Math.random() * 255, Math.random() * 255, 255];
                //});
                getColorInsideCorners = (normalizedX, normalizedY) => {
                    const leftColor = lerpColors(cornerColors[0], cornerColors[2], normalizedY);
                    const rightColor = lerpColors(cornerColors[1], cornerColors[3], normalizedY);
                    return lerpColors(leftColor, rightColor, normalizedX);
                };
                randomizeColors = () => {
                    cornerColors = getRandomCornerColorsByCircle();
                };

                getPixelAtNormalizedPoint = (x, y) => {
                    //return [
                    //	Math.floor(x * 255), Math.floor(y * 255), 50, 255
                    //];

                    const leftColor = lerpColors(cornerColors[0], cornerColors[2], y);
                    const rightColor = lerpColors(cornerColors[1], cornerColors[3], y);
                    const color = lerpColors(leftColor, rightColor, x);
                    return color;
                };

                //corner colors persistence
                {
                    gameSaving.addEventListener("beforeGameSaved", e => {
                        e.detail.savedGame.cornerColors = cornerColors;
                    });
                    gameSaving.addEventListener("afterSaveGameLoaded", e => {
                        const savedGame = e.detail.savedGame;
                        if (savedGame.cornerColors !== undefined){
                            cornerColors = savedGame.cornerColors;
                        }
                    });
                }
            }
            randomizeColors();

            //window.populateImageDataTimes = [];

            tileGradientMap = new WeakMap();

            let addRobotoFont, robotoFontLoadAttempted;
            {
                robotoFontLoadAttempted = false;
                addRobotoFont = async () => {
                    robotoFontLoadAttempted = true;
                    const fontFace = new FontFace("roboto-regular", "url(font/Roboto-Regular.ttf)");
                    const font = await fontFace.load();
                    document.fonts.add(font);
                }
            }								

            const createRectGradientImage = (startX, startY, continuous) => {
                const rectSize = Math.floor(tileSize * getCanvasPixelRatio());
                if (rectSize === 0){
                    return Promise.reject("an image can not have a size of 0");
                }

                //const getPixelAt = (x, y) => {
                //	let pixelX = (startX * rectSize);
                //	let pixelY = (startY * rectSize);
                //	if (continuous) {
                //		pixelX += x;
                //		pixelY += y;
                //	}
                //	return getPixelAtNormalizedPoint(pixelX / canvas.width, pixelY / canvas.height);
                //};

                const populateImageData = imageData => {
                    //const startTime = performance.now();
                    
                    const width = imageData.width;
                    const height = imageData.height;
                    
                    const cornerColors = [
                        getColorInsideCorners(startX / getWidth(), startY / getHeight()),
                        getColorInsideCorners((startX + 1) / getWidth(), startY / getHeight()),
                        getColorInsideCorners(startX / getWidth(), (startY + 1) / getHeight()),
                        getColorInsideCorners((startX + 1) / getWidth(), (startY + 1) / getHeight())
                    ];
                    
                    const leftDownVector = getColorVector(cornerColors[0], cornerColors[2]);
                    const rightDownVector = getColorVector(cornerColors[1], cornerColors[3]);
                    const initialHorizontalVector = getColorVector(cornerColors[0], cornerColors[1]);
                    const horizontalVelocityVector = getColorVector(leftDownVector, rightDownVector);
                    const horizontalVelocityStride = getColorVectorScaled(horizontalVelocityVector, 1 / height);
                    
                    const horizontalProgressStride = 1 / (width - 1);
                    const verticalProgressStride = 1 / (height - 1);
                    let leftDownStride = getColorVectorScaled(leftDownVector, verticalProgressStride);
                    //const rightDownStride = getColorVectorScaled(rightDownVector, verticalProgressStride);
                    
                    let currentLeftPoint = cornerColors[0].slice();
                    let currentHorizontalVector = initialHorizontalVector.slice();
                    
                    if (config.style.gradient === "discrete"){
                        leftDownStride = [0, 0, 0, 0];
                        currentHorizontalVector = [0, 0, 0, 0];
                    }

                    //const leftColor = cornerColors[0].slice();
                    //const rightColor = cornerColors[1].slice();
                    //let yProgress = 0;

                    const colArray = imageData.data;
                    let curColor = [0, 0, 0];
                    let counter = 0;
                    for (let y = 0; y < height; y++){
                        //const leftColor = lerpColors(cornerColors[0], cornerColors[2], yProgress);
                        //const rightColor = lerpColors(cornerColors[1], cornerColors[3], yProgress);
                        //const horizontalStride = rightColor.map((c, ind) => (c - leftColor[ind]) / width);
                        //let curColor = leftColor.slice();
                        
                        curColor.forEach((component, index) => curColor[index] = currentLeftPoint[index]);
                        const currentHorizontalStride = getColorVectorScaled(currentHorizontalVector, 1 / width);

                        let xProgress = 0;
                        for (let x = 0; x < width; x++){
                            //curColor = lerpColors(leftColor, rightColor, xProgress);
                            addToColorVector(curColor, currentHorizontalStride);
                            colArray[counter] = Math.round(curColor[0]);
                            colArray[counter + 1] = Math.round(curColor[1]);
                            colArray[counter + 2] = Math.round(curColor[2]);
                            colArray[counter + 3] = 255;
                            counter += 4;
                            //xProgress += horizontalProgressStride;
                        }
                        addToColorVector(currentLeftPoint, leftDownStride);
                        addToColorVector(currentHorizontalVector, horizontalVelocityStride);
                        //yProgress += verticalProgressStride;
                        //addToColorVector(leftColor, leftDownStride);
                        //addToColorVector(rightColor, rightDownStride);
                    }
                    //populateImageDataTimes.push(performance.now() - startTime);
                };
                
                const drawFunc = (canvas, ctx) => {
                    const imageData = ctx.createImageData(canvas.width, canvas.height);
                    populateImageData(imageData);
                    ctx.putImageData(imageData, 0, 0);
                    
                    //label
                    const label = getLabelByTilePosition(startX, startY);
                    ctx.scaleUniformly(tileSize);
                    ctx.translate(0.5, 0.5)
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.font = "1px roboto-regular";
                    ctx.fillStyle = config.style.gradient === "none" ? "black" : "white";
                    ctx.scaleUniformly(0.5);
                    ctx.fillText(label, 0, -0.1);
                };

                return createRectImage(rectSize, rectSize, drawFunc);
            };
            
            let gradientUpdateRunning = false;
            let gradientUpdateStopRequested = false;
            const updateGradientData = async (tiles) => {
                gradientUpdateRunning = true;

                let updateImageOfTile = tile => {
                    const initialPosition = tile.initialPosition;
                    const continuous = config.style.gradient === "continuous";
                    return createRectGradientImage(initialPosition.x, initialPosition.y, continuous)
                        .then(img => tileGradientMap.set(tile, img))
                        .catch(e => { })
                };
                //return Promise.all(tiles.map(updateImageOfTile));
                
                if (!robotoFontLoadAttempted){
                    try {
                        await addRobotoFont();
                    }
                    catch (e){
                        console.log("roboto font could not be loaded");
                    }
                }	

                for (let a = 0; a < tiles.length; a++){
                    if (gradientUpdateStopRequested){
                        break;
                    }
                    await updateImageOfTile(tiles[a]);
                    requestRender();
                }
                gradientUpdateRunning = false;
            };
            /*const updateGradientData = (tiles) => {
                const getColorVector = (from, to) => {
                    return to.map((toComponent, index) => from[index] - toComponent);
                };
                const leftSideTotalStride = getColorVector(cornerColors[0], cornerColors[2]);
                const rightSideTotalStride = getColorVector(cornerColors[1], cornerColors[3]);
                const horizontalStrideChange = getColorVector(leftSideTotalStride, rightSideTotalStride);
                const horizontalInitialStride = getColorVector(cornerColors[0], cornerColors[1]);

            };*/
            let gradientUpdateFinishedPromise = null;
            const updateImageDataAndRepaint = () => {
                if (["continuous", "discrete"].includes(config.style.gradient)) {
                    const tiles = getTiles();
                    let continuationPromise = null;
                    if (gradientUpdateRunning){
                        gradientUpdateStopRequested = true;
                        continuationPromise = gradientUpdateFinishedPromise;
                    }
                    else {
                        continuationPromise = Promise.resolve();
                    }
                    continuationPromise
                    .then(() => {
                        gradientUpdateStopRequested = false;
                        gradientUpdateFinishedPromise = updateGradientData(tiles);
                        return gradientUpdateFinishedPromise;
                    })
                    .then(() => requestRender());
                }
            };
            
            let imageUpdateBatcher = new RequestBatcher(() => updateImageDataAndRepaint());
            const requestImageUpdate = () => imageUpdateBatcher.request();

            //connect to events ###
            {
                //canvas resize
                {
                    //avoid triggering update if the canvas size is animated
                    let timeoutId = -1;
                    const requestImageUpdateAfterTimeout = () => {
                        timeoutId = -1;
                        requestImageUpdate();
                    };
                    const minResizeDeltaTime = 100;
                    const onCanvasResized = () => {
                        if (timeoutId !== -1){
                            window.clearTimeout(timeoutId);
                        }
                        timeoutId = window.setTimeout(requestImageUpdateAfterTimeout, minResizeDeltaTime);
                    };
                    canvas.addEventListener("resized", onCanvasResized);
                }

                torusSpace.addEventListener("pointCountChanged", requestImageUpdate);
                app.addEventListener("gradientConfigChanged", requestImageUpdate);
                app.addEventListener("gameStateChanged", e => {
                    if (e.detail.transition === "restart"){
                        randomizeColors();
                        requestImageUpdate();
                    }
                });
            }
        }
        //rendering ###
        let pixelRatio;
        let deviceTileSize = 1;
        let imageSize = 1;
        let imageScale = 1;
        let rightBorderInnerPixelX = 0;
        let rightBorderOuterPixelX = 0;
        let bottomBorderInnerPixelY = 0;
        let bottomBorderOuterPixelY = 0;
        const getLabelByTile = (tile) => {
            return getLabelByTilePosition(tile.initialPosition);
        };
        const getLabelByTilePosition = (x, y) => {
            return (y * getWidth() + x + 1).toString();
        };
        const renderTile = (ctx, tile, renderFunc) => {
            tilePosition = tile.position;
            const [x, y] = [tilePosition.x, tilePosition.y];
            renderFunc(ctx, tile, x, y);

            if (x > getWidth() - 1) {
                renderFunc(ctx, tile, x - getWidth(), y);
            }

            if (y > getHeight() - 1) {
                renderFunc(ctx, tile, x, y - getHeight());
            }
        };
        const renderTileImageAt = (ctx, tile, x, y) => {
            //background image
            if (config.style.gradient !== "none") {
                const backgroundImage = tileGradientMap.get(tile);
                if (backgroundImage !== undefined){
                    ctx.setTransform(1, 0, 0, 1, x * deviceTileSize, y * deviceTileSize);
                    if (backgroundImage.naturalWidth !== imageSize){
                        ctx.scaleUniformly(imageScale);
                    }
                    
                    if (tileImageAlphaMap){
                        const alpha = tileImageAlphaMap.get(tile);
                        if (alpha !== undefined){
                            ctx.globalAlpha = alpha;
                        }
                    }

                    ctx.drawImage(backgroundImage, 0, 0);
                }
            }
        };
        const renderTileOutlineAt = (ctx, tile, x, y) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.lineWidth = 0.014;
            ctx.strokeStyle = "#191919";
            ctx.strokeRect(0, 0, 1, 1);
            ctx.restore();
        };
        const renderTilesOnRect = (ctx) => {
            pixelRatio = getCanvasPixelRatio();
            deviceTileSize = tileSize * pixelRatio;
            imageSize = Math.floor(deviceTileSize);
            imageScale = imageSize / deviceTileSize;
            const width = getWidth();
            const height = getHeight();
            rightBorderInnerPixelX = (width - 1) * tileSize;
            rightBorderOuterPixelX = width * tileSize;
            bottomBorderInnerPixelY = (height - 1) * tileSize;
            bottomBorderOuterPixelY = height * tileSize;
            ctx.scaleUniformly(tileSize);
            const tiles = getTiles();
            //const tilePixelPositionMap = tileLayer.getPixelPositionsOfTiles(tileSize);
            for (let tile of tiles){
                //const tilePixelPosition = tile.position.multiply(deviceTileSize); //tilePixelPositionMap.get(tile);
                renderTile(ctx, tile, renderTileImageAt);
            }
            //for (let tile of tiles) {
            //	renderTile(ctx, tile, renderTileOutlineAt);
            //}
        };
        const rectShapeRenderComponent = {
            render: ctx => renderTilesOnRect(ctx)
        };
        renderComponents.push(rectShapeRenderComponent);


        //wave animation
        let tileImageAlphaMap, playWaveAnimation;
        {
            tileImageAlphaMap = null;
            const waveCenter = new Vector2D(2.4, 1.7);
            let waveRadius = 0;
            let maxWaveRadius = 0;
            let waveSpreadSpeed = 8;
            let playing = false;

            playWaveAnimation = waveCenterPoint => {
                if (playing){
                    return;
                }
                playing = true;
                waveCenter.set(waveCenterPoint);
                waveRadius = 0;
                const cornerPoints = [
                    new Vector2D(0, 0), new Vector2D(getWidth(), 0), 
                    new Vector2D(0, getHeight()), new Vector2D(getWidth(), getHeight())
                ];
                maxWaveRadius = Math.max(...cornerPoints.map(point => waveCenter.distanceTo(point))) + 1;

                tileImageAlphaMap = new WeakMap();
                for (let tile of getTiles()) {
                    tileImageAlphaMap.set(tile, 1);
                }
                prevTime = window.performance.now();
                loop();
            };
            
            const updateWaveAlpha = () => {
                for (let tile of getTiles()){
                    const tilePosition = tile.position;
                    const tilePositionFromCircle = waveCenter.vectorTo(tilePosition);
                    const distance = tilePositionFromCircle.getMagnitude() - waveRadius;
                    let alpha = MathUtil.mapClamped(1.2, -1.2, 0, 2, distance);
                    alpha = Math.cos(alpha * Math.PI) * 0.5 + 0.5;
                    //let alpha = MathUtil.clamp(0, 2, -distance) / 2;
                    //alpha = Math.cos((alpha + 1) * Math.PI) * 0.5 + 0.5;
                    tileImageAlphaMap.set(tile, alpha);
                }
            };

            let prevTime = performance.now();
            const loop = () => {
                const curTime = performance.now();
                const deltaTime = curTime - prevTime;
                waveRadius += deltaTime * 0.001 * waveSpreadSpeed;
                prevTime = curTime;
                updateWaveAlpha();
                requestRender();
                if (waveRadius < maxWaveRadius){
                    requestAnimationFrame(loop);
                }
                else {
                    playing = false;
                    tileImageAlphaMap = null;
                }
            };
            
            
            //play wave animation when solves
            app.addEventListener("gameStateChanged", e => {
                if (app.gameState === "finished"){
                    const dragger = getCurrentDragger();
                    if (!dragger){
                        return;
                    }
                    let currentMousePoint = dragger.currentMousePoint;
                    if (!currentMousePoint){
                        return;
                    }
                    const torusPoint = currentMousePoint.multiply(1 / tileSize);
                    makeCoordinateValidOnTorus(torusPoint);
                    playWaveAnimation(torusPoint);
                }
            });
        }
    }

    //shape: "disc" ###
    /*
    {
        const getTiles = () => tileLayer.getTiles();
        const getCircumferencePointCount = () => torusSpace.toroidalPointCount;
        const getRadiusPointCount = () => torusSpace.poloidalPointCount;

        const setCanvasSizeForDiscShape = (availableWidth, availableHeight) => {
            
            let minSideLength = Math.min(availableWidth, availableHeight);
            let [canvasWidth, canvasHeight] = [minSideLength, minSideLength];

            const scale = 0.95;
            [canvasWidth, canvasHeight] = [canvasWidth, canvasHeight].map(val => Math.floor(val * scale));

            resizeCanvas(canvasWidth, canvasHeight);
        };
        //duplicate
        canvas.addEventListener("needsResize", e => {
            setCanvasSizeForDiscShape(e.detail.availableWidth, e.detail.availableHeight);
        });

        let pixelsPerTileRadius = 0;
        let centerCircleRadius = 1.2;
        canvas.addEventListener("resized", (e) => {
            const minSideLength = Math.min(e.detail.canvasWidth, e.detail.canvasHeight);
            const margin = 20;
            const maxRadius = (minSideLength / 2) - margin;
            pixelsPerTileRadius = maxRadius / (getRadiusPointCount() + centerCircleRadius);
        });

        coordinateMapping = {
            canvasToTorus: canvasPoint => {
                const discPoint = canvasPoint.copy();
                discPoint.x -= canvas.width / 2;
                discPoint.y -= canvas.height / 2;
                discPoint.scale(1 / pixelsPerTileRadius);
                const magnitude = discPoint.getMagnitude();
                if (magnitude <= centerCircleRadius){
                    return undefined;
                }
                const normalizedTorusPoint = discPoint.copy().scale(1 / magnitude);
                const distanceToUp = Math.hypot(normalizedTorusPoint.x, 1 + normalizedTorusPoint.y);
                const angleToUp = Math.asin(distanceToUp / 2) * 2;
                const angle = discPoint.x >= 0 ? angleToUp : (Math.PI * 2) - angleToUp;
                let torusX = (angle / (Math.PI * 2)) * getCircumferencePointCount();
                torusX = MathUtil.clamp(0, getCircumferencePointCount(), torusX);
                let torusY = magnitude - centerCircleRadius;
                torusY = MathUtil.clamp(0, getRadiusPointCount(), torusY);
                return new Vector2D(torusX, torusY);
            }
        };

        //gradient
        let colorWheelImage;
        {
            const createDiscGradientImageData = () => {
                const squareSize = canvas.width;
                createRectImage(squareSize, squareSize, (x, y) => {
                    return [Math.floor(255 * x / squareSize), Math.floor(255 * y / squareSize), 80, 255];
                }).then(image => colorWheelImage = image);
            };
            canvas.addEventListener("resized", () => createDiscGradientImageData());
        }

        //almost duplicate
        const getLabelByTile = (tile) => {
            const initialPosition = tile.initialPosition;
            return (initialPosition.y * getCircumferencePointCount() + initialPosition.x + 1).toString();
        };
        //almost duplicate
        const renderTile = (ctx, tile) => {
            const tilePosition = tile.position;
            const [x, y] = [tilePosition.x, tilePosition.y];

            renderTileAt(ctx, tile, x, y);

            if (y > getRadiusPointCount() - 1) {
                renderTileAt(ctx, tile, x, y - getRadiusPointCount());
            }
        };
        const renderTileAt = (ctx, tile, x, y) => {
            ctx.save();

            const anglePerTile = (Math.PI * 2) / getCircumferencePointCount();
            const halfAnglePerTile = anglePerTile / 2;

            const angle = (x / getCircumferencePointCount()) * Math.PI * 2;
            const radius = centerCircleRadius + (y + 1);
            const middleRadius = radius - 1 / 2;
            const middleAngle = angle + halfAnglePerTile;

            ctx.scale(1, -1);
            ctx.rotate(-middleAngle);

            //disc segment path
            ctx.save();
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.arc(0, 0, radius, -halfAnglePerTile, halfAnglePerTile, false);
            ctx.arc(0, 0, radius - 1, halfAnglePerTile, -halfAnglePerTile, true);
            ctx.closePath();
            ctx.restore();

            //gradient
            {
                ctx.save();

                const wheelRadius = centerCircleRadius + getRadiusPointCount();
                const initialPosition = tile.initialPosition;

                const initialMiddleAngle = (initialPosition.x / getCircumferencePointCount()) * Math.PI * 2 + halfAnglePerTile;
                const initialMiddleRadius = centerCircleRadius + (initialPosition.y + 0.5);
                const [sin, cos] = [Math.sin(initialMiddleAngle), Math.cos(initialMiddleAngle)];
                const initialMiddlePoint = new Vector2D(sin, cos).scale(initialMiddleRadius);
                const rectCorner = new Vector2D(-wheelRadius, -wheelRadius);
                const relativeRectCorner = initialMiddlePoint.vectorTo(rectCorner);
                const localRectCornerMatrix = [ cos, sin, -sin, cos ];
                const localRectCorner = new Vector2D(
                    relativeRectCorner.x * localRectCornerMatrix[0] + relativeRectCorner.y * localRectCornerMatrix[2],
                    relativeRectCorner.x * localRectCornerMatrix[1] + relativeRectCorner.y * localRectCornerMatrix[3]
                );
                const localRectMatrix = [
                    cos, sin, -sin, cos, localRectCorner.x, localRectCorner.y
                ];

                ctx.translate(0, middleRadius);
                ctx.transform(...localRectMatrix);
                ctx.lineWidth = 0.05;
                //ctx.strokeStyle = "red";
                //ctx.strokeRect(0, 0, wheelRadius * 2, wheelRadius * 2);
                //ctx.fillStyle = "teal";
                //ctx.fillCircle(-relativeRectCorner.x, -relativeRectCorner.y, 0.1);
                
                if (colorWheelImage) {
                    ctx.scaleUniformly(1 / pixelsPerTileRadius);
                    ctx.clip();
                    ctx.drawImage(colorWheelImage, 0, 0);
                }

                ctx.restore();
            }

            //outline
            {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }

            //label
            {
                ctx.save();
                const label = getLabelByTile(tile);
                ctx.translate(0, middleRadius);
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.font = "1px sans-serif";
                ctx.fillStyle = "black";//config.style.gradient === "none" ? "black" : "white";
                ctx.scale(0.5, 0.5);
                ctx.rotate(middleAngle);
                ctx.scale(1, -1);
                ctx.fillText(label, 0, 0);
                ctx.restore();
            }

            ctx.restore();
        };
        const makeDiscPathClipping = (ctx) => {
            const maxDiscRadius = centerCircleRadius + getRadiusPointCount();
            ctx.beginPath();
            ctx.arc(0, 0, maxDiscRadius, 0, Math.PI * 2);
            ctx.arc(0, 0, centerCircleRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
        };
        const renderTilesOnDisc = (ctx) => {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scaleUniformly(pixelsPerTileRadius);
            
            ctx.save();
            makeDiscPathClipping(ctx);
            const tiles = getTiles();
            for (let tile of tiles) {
                renderTile(ctx, tile);
            }
            ctx.restore();


            //disc outlines
            {
                ctx.save();
                const maxDiscRadius = centerCircleRadius + getRadiusPointCount();
                ctx.beginPath();
                ctx.arc(0, 0, maxDiscRadius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.moveTo(centerCircleRadius, 0);
                ctx.arc(0, 0, centerCircleRadius, 0, Math.PI * 2);
                ctx.closePath();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
            }
        };
        const discShapeRenderComponent = {
            render: ctx => renderTilesOnDisc(ctx)
        };
        renderComponents.push(discShapeRenderComponent);
    }
    */
    

    //Tile Dragging ###
    let getCurrentDragger;
    {
        class TileDragger extends DragHelper {
            constructor(canvas) {
                super(canvas);
                this._currentMousePoint = null;
            }
            get currentMousePoint(){
                return this._currentMousePoint;
            }
            deactivate() {
                this.detach();
            }
            _getApp() {
                return app;
            }
            _getGameState() {
                return this._getApp().gameState;
            }
            _onRowMoved() {
                onRowMoved();
            }
            _requestRender() {
                requestRender();
            }
            get isDragging() {
                this._dragging;
            }

            onDragStart(e){
                this._currentMousePoint = e.localMousePoint;
            }
            onDrag(e) {
                this._currentMousePoint = e.localMousePoint;
            }
        }
        const CarykhTileDragger = class extends TileDragger {
            constructor(canvas) {
                super(canvas);

                this._prevMouseGridPoint = null;
                this._moveAnimations = [];
            }
            deactivate() {
                super.deactivate();
                this._skipAllAnimations();
            }
            _getMouseGridPoint(canvasPoint) {
                const gridPoint = coordinateMapping.canvasToTorus(canvasPoint);
                if (gridPoint){
                    gridPoint.transformComponents(Math.floor);
                    return gridPoint;
                }
            }
            _getShortestDeltaOnTorus(point1, point2){
                return torusSpace.getShortestPositionDelta(point1, point2);
            }
            _skipAllAnimations() {
                this._moveAnimations.slice().forEach(ani => ani.skip());
            }
            _moveRow(direction, rowIndex, stride, animate) {
                const moveAnimations = this._moveAnimations;
                const strideVector = direction === "toroidal" ? new Vector2D(stride, 0) : new Vector2D(0, stride);
                if (animate) {
                    let prevAnimProgress = 0;
                    const anim = new Animation(100,
                        progress => {
                            progress = easing.fastInSlowOut(progress);
                            tileLayer.moveTileRow(direction, rowIndex, stride * (progress - prevAnimProgress));
                            prevAnimProgress = progress;
                            requestRender();
                        },
                        () => {
                            tileLayer.moveTileRow(direction, rowIndex, (1 - prevAnimProgress) * stride);
                            tileLayer.stopTileRowMoving();

                            const animIndex = moveAnimations.indexOf(anim);
                            if (animIndex >= 0) {
                                moveAnimations.splice(animIndex, 1);
                            }
                        }
                    );
                    anim.start(true);
                    moveAnimations.push(anim);
                }
                else {
                    tileLayer.moveTileRow(direction, rowIndex, stride);
                    tileLayer.stopTileRowMoving();
                }
            }
            onDragStart(e) {
                super.onDragStart(e);
                this._prevMouseGridPoint = this._getMouseGridPoint(e.localMousePoint);
            }
            onDrag(e) {
                super.onDragStart(e);
                const prevMouseGridPoint = this._prevMouseGridPoint;
                const curMouseGridPoint = this._getMouseGridPoint(e.localMousePoint);
                if (curMouseGridPoint && prevMouseGridPoint){
                    const delta = this._getShortestDeltaOnTorus(prevMouseGridPoint, curMouseGridPoint);
                    if (delta.x !== 0 || delta.y !== 0) {
                        if (this._moveAnimations.length > 0) {
                            this._skipAllAnimations();
                        }
                        const useAnimation = !(delta.x !== 0 && delta.y !== 0);
                        for (let a = 0; a < 2; a++) {
                            const direction = ["toroidal", "poloidal"][a];
                            const prop = ["x", "y"][a];
                            const orthoProp = ["y", "x"][a];
                            const stride = delta[prop];
                            const rowIndex = prevMouseGridPoint[orthoProp];
                            if (stride !== 0) {
                                this._moveRow(direction, rowIndex, stride, useAnimation);
                                prevMouseGridPoint[prop] += stride;
                            }
                        }
                        requestRender();
                    }
                }
                this._prevMouseGridPoint = curMouseGridPoint;
            }
        };
        const SpringSnapTileDragger = class extends TileDragger {
            constructor(canvas) {
                super(canvas);

                this._mouseDownTileSpacePoint = null;
                this._prevSpringSpacePoint = null;
                this._prevTileSpacePoint = null;

                this._draggedTile = null;
                this._targetPoint = null;
                this._springPath = [];
                this._springStrength = 15;
                this._springDragState = "inactive";

                this._prevDragPoint = null;
                this._dragVectorQueue = [];
                this._maxDragQueueSize = 7;
                this._dragVectorSum = new Vector2D();
                this._currentDragDirection = "unknown";

                this.clickCount = 0;

                this._prevUpdateTime = performance.now();
                this._springPhysicsActive = true;
                this._springPhysicsState = "active";
                const loopFunc = () => {
                    if (!this._springPhysicsActive) {
                        return;
                    }
                    this._updateSpringPhysics();
                    requestAnimationFrame(loopFunc);
                };
                loopFunc();
            }

            deactivate() {
                super.deactivate();
                this._springPhysicsActive = false;
                if (this._springPath.length > 1) {
                    //this._moveTilesByPath(SpringSnapTileDragger._polylineShiftedByAHalf(this._springPath));
                }
            }

            _updateSpringPhysics() {
                const curTime = performance.now();
                const deltaTime = (curTime - this._prevUpdateTime) / 1000;

                const springPath = this._springPath;
                if (springPath.length > 1) {
                    const springPathLength = SpringSnapTileDragger._getPolylinePathLength(springPath);
                    if (springPathLength > 1e-3) {
                        this._springPhysicsState = "active";
                        const springDeltaDistance = deltaTime * this._springStrength * springPathLength;
                        const cutPath = SpringSnapTileDragger._getCutPolyline(springPath, springDeltaDistance);
                        this._springPath = cutPath[1];
                        const tileMovePath = cutPath[0].map(point => point.minusHalf());
                        this._moveTilesByPath(tileMovePath);

                        this._drawDebug();
                        this._requestRender();
                    }
                    else {
                        if (!this._dragging && this._springPhysicsState === "active") {
                            tileLayer.stopTileRowMoving();
                            this._springPhysicsState = "inactive";
                        }
                    }
                }

                this._prevUpdateTime = curTime;
            }
            _drawDebug() {
                return;
                drawDebug((ctx) => {
                    ctx.save();
                    ctx.scale(tileSize, tileSize);

                    ctx.lineWidth = 0.02;
                    ctx.strokeStyle = "black";
                    ctx.strokePolyline(this._springPath);
                    this._springPath.forEach(point => ctx.fillCircle(point.x, point.y, 0.035));

                    ctx.restore();
                });
            }
            _getSpringSpacePoint(point) {
                return this._getCurrentLeaningPoint(point);
            }
            _getShortestDeltaOnTorus(point1, point2){
                return torusSpace.getShortestPositionDelta(point1, point2);
            }
            _handleSpringDeltaAppending(curSpringSpacePoint) {
                
                const springPath = this._springPath;
                const prevSpringSpacePoint = springPath[springPath.length - 1];
                const prevSpringSpacePointOnTorus = prevSpringSpacePoint.copy();
                makeCoordinateValidOnTorus(prevSpringSpacePointOnTorus);
                
                const springSpaceDelta = this._getShortestDeltaOnTorus(prevSpringSpacePointOnTorus, curSpringSpacePoint);
                if (springSpaceDelta.x === 0 && springSpaceDelta.y === 0) {
                    return;
                }
                const curSpringSpacePointAccordingToDelta = prevSpringSpacePoint.plus(springSpaceDelta);
                let quantizedDeltaPath = SpringSnapTileDragger._getQuantizedGridIntersectionPath(prevSpringSpacePoint, curSpringSpacePointAccordingToDelta);
                quantizedDeltaPath.forEach(vec => vec.transformComponents(c => c + 0.5));
                if (quantizedDeltaPath.length > 1) {
                    const insertRest = (fromIndex, toIndex, restPoint, insertAfter) => {
                        const deltaVec = quantizedDeltaPath[fromIndex].vectorTo(quantizedDeltaPath[toIndex]).signed();
                        const fromPointToRest = quantizedDeltaPath[fromIndex].vectorTo(restPoint).signed();
                        quantizedDeltaPath.splice(fromIndex + (insertAfter ? 1 : 0), 0, restPoint);
                        if (fromPointToRest.equals(deltaVec)) {
                            quantizedDeltaPath.splice(fromIndex + (insertAfter ? 0 : +1), 1);
                        }
                    };

                    insertRest(0, 1, prevSpringSpacePoint);
                    insertRest(quantizedDeltaPath.length - 1, quantizedDeltaPath.length - 2, curSpringSpacePointAccordingToDelta, true);
                }
                else {
                    quantizedDeltaPath = [];
                    const center = this._targetPointTilePosition.transformedComponents(c => c + 0.5);
                    const [localPrev, localCur] = [prevSpringSpacePoint, curSpringSpacePointAccordingToDelta].map(point => center.vectorTo(point));
                    quantizedDeltaPath.push(prevSpringSpacePoint, curSpringSpacePointAccordingToDelta);
                    if (!localPrev.signed().equals(localCur.signed())) {
                        quantizedDeltaPath.splice(1, 0, center);
                    }
                }
                quantizedDeltaPath = SpringSnapTileDragger._simplifyPolyline(quantizedDeltaPath);

                //try appending the delta-path
                if (springPath.length < 2) {
                    springPath.push(...quantizedDeltaPath);
                }
                else {
                    let curDeltaPathTargetIndex = 1;
                    for (let a = 0; a < 100000; a++) {
                        if (curDeltaPathTargetIndex === quantizedDeltaPath.length) {
                            break;
                        }
                        const lastPathPoint = springPath[springPath.length - 1];
                        const curStrideTarget = quantizedDeltaPath[curDeltaPathTargetIndex];
                        if (springPath.length === 1) {
                            springPath.push(curStrideTarget);
                            curDeltaPathTargetIndex++;
                            continue;
                        }
                        const secondLastPathPoint = springPath[springPath.length - 2];
                        const lastSegmentVec = lastPathPoint.vectorTo(secondLastPathPoint);
                        const lastSegmentVecSigned = lastSegmentVec.signed();

                        const curStrideVector = lastPathPoint.vectorTo(curStrideTarget);
                        const curStrideVectorSigned = curStrideVector.signed();
                        if (curStrideVectorSigned.equals(lastSegmentVecSigned)) {
                            const curStrideMag = SpringSnapTileDragger._getAlignedVectorLength(curStrideVector);
                            const lastSegmentMag = SpringSnapTileDragger._getAlignedVectorLength(lastSegmentVec);
                            if (curStrideMag < lastSegmentMag) {
                                springPath[springPath.length - 1] = curStrideTarget;
                            }
                            else {
                                springPath.splice(springPath.length - 1, 1);
                            }

                            if (curStrideMag <= lastSegmentMag) {
                                curDeltaPathTargetIndex++;
                            }
                        }
                        else {
                            springPath.push(curStrideTarget);
                            curDeltaPathTargetIndex++;
                        }
                    }
                }
                this._springPath = SpringSnapTileDragger._simplifyPolyline(springPath);
            }

            _moveTilesByPath(movePath) {
                if (movePath.length === 0) {
                    return;
                }
                const draggedTile = this._draggedTile;
                for (let a = 1; a < movePath.length; a++) {
                    const draggedTileTargetPoint = movePath[a];
                    const draggedTileTargetPointQuantized = draggedTileTargetPoint.plusHalf().quantized(1);
                    const prevPoint = movePath[a - 1];
                    const curMoveVec = prevPoint.vectorTo(draggedTileTargetPoint);
                    const curMoveDir = curMoveVec.x === 0 ? "poloidal" : "toroidal";
                    const curMoveAmount = curMoveDir === "toroidal" ? curMoveVec.x : curMoveVec.y;
                    const rowIndex = curMoveDir === "toroidal" ? prevPoint.y : prevPoint.x;
                    tileLayer.moveTileRow(curMoveDir, rowIndex, curMoveAmount);
                }
            }

            //leaning ###
            _getLeaning(val) {
                let scale = 1;
                //const dragVecSum = this._dragVectorSum;
                //if (dragVecSum.x !== 0 || dragVecSum.y !== 0){
                //	const dragVecSumNorm = dragVecSum.normalized();
                //	scale = Math.abs(dragVecSumNorm.x - dragVecSumNorm.y);
                //}

                return Math.sign(val) * Math.log(Math.abs(val) + 1) * scale * 0.2;
            }
            _getSimpleLeaningPoint(point) {
                const middle = point.quantized(1).transformComponents(c => c += 0.5);
                const diff = middle.vectorTo(point);
                return Math.abs(diff.x) > Math.abs(diff.y) ?
                    middle.plus(new Vector2D(diff.x, 0)) : middle.plus(new Vector2D(0, diff.y));
            }
            _getLeaningPoint(point, direction) {
                const tilePosition = point.quantized(1).plusHalf();
                const rawLeaningVector = tilePosition.vectorTo(point);
                const leaningVector = new Vector2D();
                if (direction === "horizontal") {
                    leaningVector.x = this._getLeaning(rawLeaningVector.x);
                }
                else if (direction === "vertical") {
                    leaningVector.y = this._getLeaning(rawLeaningVector.y);
                }
                return tilePosition.plus(leaningVector);
            }
            _getCurrentLeaningPoint(point) {
                return this._getLeaningPoint(point, this._currentDragDirection);
            }

            //polyline util ###
            static _getAlignedVectorLength(vector) {
                return Math.abs(vector.x !== 0 ? vector.x : vector.y);
            }
            static _getQuantizedGridIntersectionPath(startPoint, endPoint) {
                const gridIntersectionData = MathUtil.getLineToGridLineIntersections(startPoint, endPoint);
                const curPoint = startPoint.quantized(1);
                const signVector = startPoint.vectorTo(endPoint).transformComponents(Math.sign);
                const quantizedIntersectionPath = [curPoint.copy()];
                for (let intersectionData of gridIntersectionData) {
                    const strideDirection = intersectionData.lineDirection === "vertical" ? "horizontal" : "vertical";

                    if (strideDirection === "horizontal") {
                        curPoint.x += signVector.x;
                    }
                    else if (strideDirection === "vertical") {
                        curPoint.y += signVector.y;
                    }
                    quantizedIntersectionPath.push(curPoint.copy());
                }
                return quantizedIntersectionPath;
            }
            static _removeZeroSegmentsFromPolyline(polyline) {
                let doublesRemoved = [polyline[0]];
                for (let a = 1; a < polyline.length; a++) {
                    const point = polyline[a];
                    const lastFromDoublesRemoved = doublesRemoved[doublesRemoved.length - 1];
                    if (!point.equals(lastFromDoublesRemoved)) {
                        doublesRemoved.push(point);
                    }
                }
                return doublesRemoved;
            }
            //only works with perfectly horizontal/vertical segments
            static _removeRedundantSubdivisions(polyline) {
                if (polyline.length < 2) {
                    return polyline;
                }

                const signedDeltaVectors = [];
                for (let a = 0; a < polyline.length - 1; a++) {
                    signedDeltaVectors.push(polyline[a].vectorTo(polyline[a + 1]).signed());
                }

                const signedVectorChangeIndices = [0];
                for (let a = 1; a < signedDeltaVectors.length; a++) {
                    if (!signedDeltaVectors[a].equals(signedDeltaVectors[a - 1])) {
                        signedVectorChangeIndices.push(a);
                    }
                }
                signedVectorChangeIndices.push(polyline.length - 1);

                const withoutRedundancy = signedVectorChangeIndices.map(index => polyline[index]);
                return withoutRedundancy;
            }
            static _simplifyPolyline(polyline) {
                let simplified = polyline;
                simplified = SpringSnapTileDragger._removeZeroSegmentsFromPolyline(simplified);
                simplified = SpringSnapTileDragger._removeRedundantSubdivisions(simplified);
                return simplified;
            }
            static _getCutPolyline(polyline, pathLength) {
                const beforeCut = [polyline[0]];
                let currentLength = 0;
                let connectingIndex = 0;
                for (let a = 0; a < polyline.length - 1; a++) {
                    const segmentVec = polyline[a].vectorTo(polyline[a + 1]);
                    const segmentLength = SpringSnapTileDragger._getAlignedVectorLength(segmentVec);
                    const nextLength = currentLength + segmentLength;
                    if (nextLength <= pathLength) {
                        beforeCut.push(polyline[a + 1]);
                    }
                    else {
                        const missingSegmentLength = segmentLength - (nextLength - pathLength);
                        const prop = segmentVec.x !== 0 ? "x" : "y";
                        const missingEndPoint = new Vector2D();
                        missingEndPoint[prop] = Math.sign(segmentVec[prop]) * missingSegmentLength;
                        missingEndPoint.add(polyline[a]);
                        beforeCut.push(missingEndPoint);
                    }

                    if (nextLength >= pathLength) {
                        connectingIndex = nextLength > pathLength ? a + 1 : a + 2;
                        break;
                    }
                    currentLength = nextLength;
                }

                const afterCut = [beforeCut[beforeCut.length - 1], ...polyline.slice(connectingIndex)];

                return [beforeCut, afterCut];
            }
            static _getPolylinePathLength(polyline) {
                let pathLength = 0;
                for (let a = 0; a < polyline.length - 1; a++) {
                    pathLength += SpringSnapTileDragger._getAlignedVectorLength(polyline[a].vectorTo(polyline[a + 1]));
                }
                return pathLength;
            }
            static _polylineShiftedByAHalf(polyline) {
                return polyline.map(point => point.transformedComponents(c => c + 0.5));
            }

            _canvasPointToTileSpace(canvasPoint){
                return coordinateMapping.canvasToTorus(canvasPoint);
            }

            _handleDragDirection(e) {
                const curDragVector = e.localMousePoint.vectorTo(this._prevDragPoint);
                if (curDragVector.x === 0 && curDragVector.y === 0) {
                    return;
                }
                this._dragVectorQueue.unshift(curDragVector);
                if (this._dragVectorQueue.length > this._maxDragQueueSize) {
                    this._dragVectorQueue.pop();
                }
                if (this._dragVectorQueue.length === this._maxDragQueueSize) {
                    const dragVectorSum = new Vector2D();
                    this._dragVectorQueue.forEach(vec => dragVectorSum.add(vec.transformedComponents(Math.abs)));
                    this._currentDragDirection = Math.abs(dragVectorSum.x) > Math.abs(dragVectorSum.y) ? "horizontal" : "vertical";
                    this._dragVectorSum = dragVectorSum;
                }
                this._prevDragPoint = e.localMousePoint;
            }

            _handleSpringPathDragStart(tileSpacePoint, e){
                //handle the current spring path immediately
                if (this._springPath.length > 0) {
                    this._moveTilesByPath(this._springPath.map(point => point.minusHalf()));
                    tileLayer.stopTileRowMoving();
                }
                this._springPath = [];

                this._mouseDownTileSpacePoint = tileSpacePoint;
                this._targetPoint = tileSpacePoint.copy();
                this._targetPointTilePosition = this._targetPoint.quantized(1);

                this._draggedTile = tileLayer.getTileAtPoint(this._targetPointTilePosition);
                this._prevSpringSpacePoint = this._getSpringSpacePoint(tileSpacePoint);
                this._springPath.push(this._targetPointTilePosition.plusHalf());
            }
            _handleSpringPathDragEnd(){
                this._handleSpringDeltaAppending(this._prevSpringSpacePoint.quantized().plusHalf());
            }
            _handleSpringPathDrag(tileSpacePoint){
                this._targetPoint = tileSpacePoint.copy();
                this._targetPointTilePosition = this._targetPoint.quantized(1);

                //construct and append the delta-path
                const curSpringSpacePoint = this._getSpringSpacePoint(tileSpacePoint);
                this._handleSpringDeltaAppending(curSpringSpacePoint);

                this._prevSpringSpacePoint = curSpringSpacePoint;
            }


            onDragStart(e) {
                super.onDragStart(e);

                this.clickCount++;
                if (this.clickCount > 1) {
                    //this.onDrag(e);
                    //return;
                }

                this._prevDragPoint = e.localMousePoint;

                const tileSpacePoint = this._canvasPointToTileSpace(e.localMousePoint);
                if (tileSpacePoint){
                    this._handleSpringPathDragStart(tileSpacePoint, e);
                }
                this._prevTileSpacePoint = tileSpacePoint.copy();

                this._drawDebug();
                this._requestRender();
            }
            
            onDrag(e) {
                super.onDragStart(e);
                this._handleDragDirection(e);

                const tileSpacePoint = this._canvasPointToTileSpace(e.localMousePoint);
                const prevTileSpacePoint = this._prevTileSpacePoint;
                if (!tileSpacePoint && prevTileSpacePoint){
                    this._handleSpringPathDragEnd();
                }
                else if (tileSpacePoint && !prevTileSpacePoint){
                    this._handleSpringPathDragStart(tileSpacePoint, e);
                }
                else if (tileSpacePoint && prevTileSpacePoint) {
                    this._handleSpringPathDrag(tileSpacePoint);
                }
                this._prevTileSpacePoint = tileSpacePoint;

                this._drawDebug();
                this._requestRender();
            }
            onDragEnd(e) {

                super.onDragEnd(e);
                this._dragVectorQueue = [];
                this._currentDragDirection = "unknown";

                if (this._prevTileSpacePoint){
                    this._handleSpringPathDragEnd();
                }

                this._drawDebug();
                this._requestRender();
            }
        };
        const draggerMap = {
            "animate transition": (canvas) => new CarykhTileDragger(canvas),
            "spring and snap": (canvas) => new SpringSnapTileDragger(canvas)
        };

        let currentDragger = null;
        getCurrentDragger = () => currentDragger;
        const updateDragger = () => {
            if (currentDragger) {
                currentDragger.deactivate();
            }
            currentDragger = draggerMap[config.draggingMethod](canvas);
        };
        app.addEventListener("configChanged", updateDragger);
        updateDragger();
    }

    //number of moves tracking ###
    const turnTracker = new EventTarget();
    window.turnTracker = turnTracker;
    {
        let numberOfMoves = 0;
        Object.defineProperty(turnTracker, "numberOfMoves", { get: () => numberOfMoves });
        turnTracker.reset = () => {
            changeNumberOfMoves(0);
        };
        turnTracker.init = initialNumberOfMoves => {
            changeNumberOfMoves(initialNumberOfMoves);
        };

        const changeNumberOfMoves = newNumberOfMoves => {
            const numberOfMovesBefore = numberOfMoves;
            numberOfMoves = newNumberOfMoves;
            turnTracker.dispatchEvent(new CustomEvent("numberOfMovesChanged", {detail: {
                numberOfMovesBefore: numberOfMovesBefore,
                numberOfMoves: numberOfMoves, 
                numberOfMovesDelta: newNumberOfMoves - numberOfMovesBefore
            }}));
        };

        tileLayer.addEventListener("rowGridPositionChanged", e => {
            if (app.gameState !== "finished"){
                changeNumberOfMoves(numberOfMoves + e.detail.rowGridPositionDelta);
            }
        });
    }
    



    document.addEventListener("pageVisibilityChanged", e => {
        const visible = e.detail.pageVisible;
        if (visible){
            app.resume();
        }
        else {
            app.pause();
        }
    });

    canvas.addEventListener("resized", requestRender);
    app.addEventListener("configChanged", requestRender);

    //finish the game of all rows just stopped moving and 
    //all tiles are in their initial position
    tileLayer.addEventListener("rowMovingStopped", e => {
        if (app.gameState === "running" && tileLayer.areTileGridPositionsInInitialState()) {
            app.finish();
        }
    });

    //connect turn tracker to app state
    {
        //start the game if the first move was just  made
        turnTracker.addEventListener("numberOfMovesChanged", e => {
            if (app.gameState !== "finished" && e.detail.numberOfMovesBefore === 0 && e.detail.numberOfMovesDelta > 0){
                app.start();
            }
        });
        app.addEventListener("gameStateChanged", e => {
            if (e.detail.transition === "restart"){
                turnTracker.reset();
            }
        });
    }

    //scramble on start
    {
        const scramble = () => {
            if (config.scrambleOnStart){
                tileLayer.performRandomMoves(torusSpace.toroidalPointCount * torusSpace.poloidalPointCount * 4);
            }
        };
        app.addEventListener("gameStateChanged", e => {
            if (e.detail.transition === "restart"){
                scramble();
                requestRender();
            }
        });
        scramble();
    }

    revealHelper.addEventListener("revealStateChanged", e => {
        const state = e.detail.revealState;
        if (state === "opening") {
            app.pause();
        }
        else if (state === "closed") {
            app.resume();
        }
        else if (state === "closing") {
            app.applyConfig(appSettings.getConfig());
        }
    });

    //turn text green when finished
    /*
    {
        const setColorOfText = (color) => {
            [	
                document.querySelector("#number-moves-element"), 
                document.querySelector("#elapsed-time-element")
            ].forEach(el => el.style.color = color);
        };
        app.addEventListener("gameStateChanged", e => {
            if (e.detail.transition === "finish") {
                setColorOfText("green");
            }
            else if (e.detail.prevGameState === "finished") {
                setColorOfText("unset");
            }
        });
    }
    */
    
    //turn top bar green when finished
    {
        const setColor = color => {
            document.querySelector("#game-controls").style.backgroundColor = color;
        };
        app.addEventListener("gameStateChanged", e => {
            if (e.detail.transition === "finish") {
                setColor("#50ab0a");
            }
            else if (e.detail.prevGameState === "finished") {
                setColor("");
            }
        });
    }

    requestRender();
}