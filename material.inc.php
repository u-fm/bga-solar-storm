<?php
/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * SolarStorm implementation : © Christophe Badoit <gameboardarena@tof2k.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * material.inc.php
 *
 * SolarStorm game material description
 *
 * Here, you can describe the material of your game with PHP variables.
 *
 * This file is loaded in your game logic class constructor, ie these variables
 * are available everywhere in your game logic code.
 *
 */

/*

Example:

$this->card_types = array(
    1 => array( "card_name" => ...,
                ...
              )
);

*/

$this->resourceTypes = [
	'data' => [
		'id' => 'data',
		'name' => clienttranslate('Data'),
		'nametr' => clienttranslate('Data'),
	],
	'metal' => [
		'id' => 'metal',
		'name' => clienttranslate('Metal'),
		'nametr' => clienttranslate('Metal'),
	],
	'nanobots' => [
		'id' => 'nanobots',
		'name' => clienttranslate('Nanobots'),
		'nametr' => clienttranslate('Nanobots'),
	],
	'energy' => [
		'id' => 'energy',
		'name' => clienttranslate('Energy'),
		'nametr' => clienttranslate('Energy'),
	],
	'universal' => [
		'id' => 'universal',
		'name' => clienttranslate('Universal'),
		'nametr' => clienttranslate('Universal'),
	],
];

$this->roomInfos = [
	0 => [
		'slug' => 'energy-core',
		'name' => clienttranslate('Energy Core'),
		'description' => clienttranslate(
			"When all rooms have diverted power,\n get here and use 1 action to reactivate the Energy Core.\nThen all players win the game!"
		),
		'resources' => [],
		'divertResources' => [],
		'color' => '#6E7C85',
	],
	1 => [
		'slug' => 'mess-hall',
		'name' => clienttranslate('Mess Hall'),
		'description' => clienttranslate('Give, take or exchange a resource card with another player.'),
		'resources' => ['nanobots', 'energy', 'data'],
		'divertResources' => ['data', 'data', 'energy'],
		'color' => '#814438',
	],
	2 => [
		'slug' => 'repair-centre',
		'name' => clienttranslate('Repair Centre'),
		'description' => clienttranslate("Repair a damaged room by one space on the Repair Track.\nDiscard the matching card."),
		'resources' => ['metal', 'energy', 'nanobots'],
		'divertResources' => ['data', 'energy', 'nanobots'],
		'color' => '#968B3C',
	],
	3 => [
		'slug' => 'medical-bay',
		'name' => clienttranslate('Medical Bay'),
		'description' => clienttranslate('Take two actions tokens when starting in this room.'),
		'resources' => ['metal', 'nanobots', 'energy'],
		'divertResources' => ['data', 'energy', 'energy'],
		'color' => '#1F73AE',
	],
	4 => [
		'slug' => 'engine-room',
		'name' => clienttranslate('Engine Room'),
		'description' => clienttranslate('Swap a card from your hand with one from the discard pile.'),
		'resources' => ['data', 'metal', 'nanobots'],
		'divertResources' => ['metal', 'nanobots', 'nanobots'],
		'color' => '#A06828',
	],
	5 => [
		'slug' => 'crew-quarters',
		'name' => clienttranslate('Crew Quarters'),
		'description' => clienttranslate("Move a player's meeple to a room that has another meeple in it."),
		'resources' => ['energy', 'data', 'metal'],
		'divertResources' => ['metal', 'metal', 'nanobots'],
		'color' => '#6F9F38',
	],
	6 => [
		'slug' => 'cargo-hold',
		'name' => clienttranslate('Cargo Hold'),
		'description' => clienttranslate("Look at the next 5 resources cards.\nThen put them back in any order."),
		'resources' => ['energy', 'metal', 'data'],
		'divertResources' => ['data', 'metal', 'nanobots'],
		'color' => '#2A7844',
	],
	7 => [
		'slug' => 'armoury',
		'name' => clienttranslate('Armoury'),
		'description' => clienttranslate(
			"Place 2 protection tokens on any rooms(s).\nThey are removed a the start of your next turn."
		),
		'resources' => ['data', 'nanobots', 'metal'],
		'divertResources' => ['metal', 'energy', 'nanobots'],
		'color' => '#5D3F8E',
	],
	8 => [
		'slug' => 'bridge',
		'name' => clienttranslate('Bridge'),
		'description' => clienttranslate('Look at the next 3 Damage cards and put them back in any order.'),
		'resources' => ['nanobots', 'data', 'energy'],
		'divertResources' => ['data', 'metal', 'energy'],
		'color' => '#7B191B',
	],
];

$this->damageCardsInfos = [
	['bridge'],
	['crew-quarters'],
	['mess-hall'],
	['repair-centre'],
	['engine-room'],
	['cargo-hold'],
	['armoury'],
	['medical-bay'],
	['engine-room', 'repair-centre'],
	['medical-bay', 'crew-quarters'],
	['repair-centre', 'cargo-hold'],
	['bridge', 'armoury'],
	['armoury', 'mess-hall'],
	['bridge', 'cargo-hold'],
	['crew-quarters', 'mess-hall'],
	['engine-room', 'medical-bay'],
	['bridge', 'medical-bay', 'mess-hall'],
	['bridge', 'engine-room', 'crew-quarters'],
	['engine-room', 'armoury', 'cargo-hold'],
	['medical-bay', 'cargo-hold', 'mess-hall'],
	['engine-room', 'repair-centre', 'mess-hall'],
	['bridge', 'repair-centre', 'crew-quarters'],
	['medical-bay', 'repair-centre', 'armoury'],
	['crew-quarters', 'armoury', 'cargo-hold'],
];
