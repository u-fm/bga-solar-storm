<?php
/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * SolarStorm implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

require_once APP_GAMEMODULE_PATH . 'module/table/table.game.php';

require_once 'modules/SolarStormRooms.php';

class SolarStorm extends Table {

	/** @var SolarStormRooms */
	private $rooms;

	function __construct() {
		parent::__construct();
		self::initGameStateLabels([]);
		$this->rooms = new SolarStormRooms();
	}

	protected function getGameName() {
		// Used for translations and stuff. Please do not modify.
		return 'solarstorm';
	}

	/*
	 * setupNewGame:
	 * This method is called only once, when a new game is launched.
	 * In this method, you must setup the game according to the game rules, so that
	 * the game is ready to be played.
	 */
	protected function setupNewGame($players, $options = []) {
		$gameinfos = self::getGameinfos();
		$defaultColors = $gameinfos['player_colors'];

		// Create players
		// Note: if you added some extra field on "player" table in the database (dbmodel.sql), you can initialize it there.
		$sql =
			'INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES ';
		$values = [];
		foreach ($players as $playerId => $player) {
			$color = array_shift($defaultColors);
			$values[] =
				"('" .
				$playerId .
				"','$color','" .
				$player['player_canal'] .
				"','" .
				addslashes($player['player_name']) .
				"','" .
				addslashes($player['player_avatar']) .
				"')";
		}
		$sql .= implode($values, ',');
		self::DbQuery($sql);
		self::reattributeColorsBasedOnPreferences(
			$players,
			$gameinfos['player_colors']
		);
		self::reloadPlayersBasicInfos();

		/************ Start the game initialization *****/

		$this->rooms->generateRooms();

		// Activate first player (which is in general a good idea :) )
		$this->activeNextPlayer();

		/************ End of the game initialization *****/
	}

	protected function getAllDatas() {
		$result = [];

		$currentPlayerId = self::getCurrentPlayerId();

		// Get information about players
		// Note: you can retrieve some extra field you added for "player" table in "dbmodel.sql" if you need it.
		$sql = 'SELECT player_id id, player_score score FROM player ';
		$result['players'] = self::getCollectionFromDb($sql);

		$result['rooms'] = $this->rooms->toArray();

		return $result;
	}

	/*
        getGameProgression:
        
        Compute and return the current game progression.
        The number returned must be an integer beween 0 (=the game just started) and
        100 (= the game is finished or almost finished).
    
        This method is called each time we are in a game state with the "updateGameProgression" property set to true 
        (see states.inc.php)
    */
	function getGameProgression() {
		// TODO: compute and return the game progression

		return 0;
	}

	//////////////////////////////////////////////////////////////////////////////
	//////////// Utility functions
	////////////

	/*
        In this space, you can put any utility methods useful for your game logic
    */

	//////////////////////////////////////////////////////////////////////////////
	//////////// Player actions
	////////////

	/*
        Each time a player is doing some game action, one of the methods below is called.
        (note: each method below must match an input method in solarstorm.action.php)
    */

	/*
    
    Example:

    function playCard( $card_id )
    {
        // Check that this is the player's turn and that it is a "possible action" at this game state (see states.inc.php)
        self::checkAction( 'playCard' ); 
        
        $player_id = self::getActivePlayerId();
        
        // Add your game logic to play a card there 
        ...
        
        // Notify all players about the card played
        self::notifyAllPlayers( "cardPlayed", clienttranslate( '${player_name} plays ${card_name}' ), [
            'player_id' => $player_id,
            'player_name' => self::getActivePlayerName(),
            'card_name' => $card_name,
            'card_id' => $card_id
        ] );
          
    }
    
    */

	//////////////////////////////////////////////////////////////////////////////
	//////////// Game state arguments
	////////////

	/*
        Here, you can create methods defined as "game state arguments" (see "args" property in states.inc.php).
        These methods function is to return some additional information that is specific to the current
        game state.
    */

	/*
    
    Example for game state "MyGameState":
    
    function argMyGameState()
    {
        // Get some values from the current game situation in database...
    
        // return values:
        return [
            'variable1' => $value1,
            'variable2' => $value2,
            ...
        ];
    }    
    */

	//////////////////////////////////////////////////////////////////////////////
	//////////// Game state actions
	////////////

	/*
        Here, you can create methods defined as "game state actions" (see "action" property in states.inc.php).
        The action method of state X is called everytime the current game state is set to X.
    */

	/*
    
    Example for game state "MyGameState":

    function stMyGameState()
    {
        // Do some stuff ...
        
        // (very often) go to another gamestate
        $this->gamestate->nextState( 'some_gamestate_transition' );
    }    
    */

	//////////////////////////////////////////////////////////////////////////////
	//////////// Zombie
	////////////

	/*
        zombieTurn:
        
        This method is called each time it is the turn of a player who has quit the game (= "zombie" player).
        You can do whatever you want in order to make sure the turn of this player ends appropriately
        (ex: pass).
        
        Important: your zombie code will be called when the player leaves the game. This action is triggered
        from the main site and propagated to the gameserver from a server, not from a browser.
        As a consequence, there is no current player associated to this action. In your zombieTurn function,
        you must _never_ use getCurrentPlayerId() or getCurrentPlayerName(), otherwise it will fail with a "Not logged" error message. 
    */

	function zombieTurn($state, $active_player) {
		$statename = $state['name'];

		if ($state['type'] === 'activeplayer') {
			switch ($statename) {
				default:
					$this->gamestate->nextState('zombiePass');
					break;
			}

			return;
		}

		if ($state['type'] === 'multipleactiveplayer') {
			// Make sure player is in a non blocking status for role turn
			$this->gamestate->setPlayerNonMultiactive($active_player, '');

			return;
		}

		throw new feException(
			'Zombie mode not supported at this game state: ' . $statename
		);
	}

	///////////////////////////////////////////////////////////////////////////////////:
	////////// DB upgrade
	//////////

	/*
        upgradeTableDb:
        
        You don't have to care about this until your game has been published on BGA.
        Once your game is on BGA, this method is called everytime the system detects a game running with your old
        Database scheme.
        In this case, if you change your Database scheme, you just have to apply the needed changes in order to
        update the game database and allow the game to continue to run with your new version.
    
    */

	function upgradeTableDb($from_version) {
		// $from_version is the current version of this game database, in numerical form.
		// For example, if the game was running with a release of your game named "140430-1345",
		// $from_version is equal to 1404301345
		// Example:
		//        if( $from_version <= 1404301345 )
		//        {
		//            // ! important ! Use DBPREFIX_<table_name> for all tables
		//
		//            $sql = "ALTER TABLE DBPREFIX_xxxxxxx ....";
		//            self::applyDbUpgradeToAllDB( $sql );
		//        }
		//        if( $from_version <= 1405061421 )
		//        {
		//            // ! important ! Use DBPREFIX_<table_name> for all tables
		//
		//            $sql = "CREATE TABLE DBPREFIX_xxxxxxx ....";
		//            self::applyDbUpgradeToAllDB( $sql );
		//        }
		//        // Please add your future database scheme changes here
		//
		//
	}
}
