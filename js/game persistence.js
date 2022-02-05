//gamestate persistence
{
    const savedGameKey = "torustiles-saved-game";

    const loadSavedGame = () => {
        let loaded = localStorage.getItem(savedGameKey);
        if (loaded) {
            loaded = JSON.parse(loaded);
            gameSaving.dispatchEvent(new CustomEvent("afterSaveGameLoaded", { detail: { savedGame: { ...loaded } } }));

            if (loaded.tilePositions){
                const tilePositions = loaded.tilePositions.map(pos => new Vector2D(pos.x, pos.y));
                tileLayer.setTilePositions(tilePositions);
            }

            //elapsed time
            const gameStartedCallback = (e) => {
                if (e.detail.transition === "start"){
                    gameTimer.init(loaded.elapsedTime);
                }
                app.removeEventListener("gameStateChanged", gameStartedCallback);
            };
            app.addEventListener("gameStateChanged", gameStartedCallback);

            turnTracker.init(loaded.numberOfMoves);

            app.start();
        }
    };
    loadSavedGame();

    const saveCurrentGame = () => {
        tileLayer.stopTileRowMoving();
        const savedGame = {
            tilePositions: tileLayer.getTiles().map(tile => tile.position),
            numberOfMoves: turnTracker.numberOfMoves,
            elapsedTime: gameTimer.elapsedTime,
            gameState: app.gameState
        };
        gameSaving.dispatchEvent(new CustomEvent("beforeGameSaved", { detail: { savedGame: savedGame } }));
        localStorage.setItem(savedGameKey, JSON.stringify(savedGame));
    };

    const saveOrDeleteGame = () => {
        if (app.gameState === "running" || app.gameState === "paused") {
            saveCurrentGame();
        }
        else {
            localStorage.removeItem(savedGameKey);
        }
    };
    document.addEventListener("pageVisibilityChanged", e => {
        if (!e.detail.pageVisible) {
            saveOrDeleteGame();
        }
    });
}