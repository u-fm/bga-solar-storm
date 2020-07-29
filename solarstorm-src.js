// vim: tw=120:
/**
 *------
 * BGA framework: © Gregory Isabelli <gisabelli@boardgamearena.com> & Emmanuel Colin <ecolin@boardgamearena.com>
 * SolarStorm implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * solarstorm.js
 *
 * SolarStorm user interface script
 *
 * In this file, you are describing the logic of your user interface, in Javascript language.
 *
 */

// Utility : first element matching selector
function $first(selector) {
	return document.querySelectorAll(selector)[0]
}

define(['dojo', 'dojo/_base/declare', 'ebg/core/gamegui', 'ebg/counter', 'ebg/stock'], function(dojo, declare) {
	return declare('bgagame.solarstorm', ebg.core.gamegui, {
		constructor: function() {
			this.rooms = new SSRooms()
			this.players = new SSPlayers(this)
			this.resourceTypes = []
			this.damageDeck = null
			this.resourceDeck = null
			this.reorderResourceDeck = null
			this.reorderDamageDeck = null
		},

		setup: function(gamedatas) {
			this.resourceTypes = gamedatas.resourceTypes
			this.initializePlayArea()
			this.initializePlayersArea()
			this.initializeDamageDeck()
			this.initializeResourceDeck()
			this.setupNotifications()
		},

		initializePlayArea() {
			// Initialize rooms
			this.gamedatas.rooms.forEach(roomData => {
				const room = new SSRoom(this, roomData)
				this.rooms.addRoom(room)
			})
		},

		initializePlayersArea() {
			const playersData = this.gamedatas.ssPlayers.sort((p1, p2) => p1.order - p2.order)
			playersData.forEach(data => {
				const player = new SSPlayer(this, data.id, data.name, data.color, data.order, data.position, data.actionsTokens)
				this.players.addPlayer(player)
			})

			for (const [playerId, playerCards] of Object.entries(this.gamedatas.resourceCards)) {
				playerCards.forEach(resourceCard => {
					this.players.getPlayerById(playerId).stock.addToStockWithId(resourceCard.type, resourceCard.id)
				})
			}
			this.rooms.rooms.forEach(r => r.updateProtectionTokens())
		},

		initializeDamageDeck() {
			const damageDeckEl = $first('.ss-damage-deck')
			this.damageDeck = this.createDamageStock(damageDeckEl)
			this.damageDeck.setOverlap(0.01)
			this.damageDeck.setSelectionMode(0)
			for (let card of Object.values(this.gamedatas.damageCardsDiscarded)) {
				this.damageDeck.addToStock(card.type)
			}

			const reorderDamageDeckEl = $first('.ss-damage-reorder-deck')
			this.reorderDamageDeck = this.createDamageStock(reorderDamageDeckEl)
		},

		initializeResourceDeck() {
			const resourceDeckEl = $first('.ss-resource-deck__table')
			this.resourceDeck = this.createResourceStock(resourceDeckEl)
			this.resourceDeck.setOverlap(50)
			this.resourceDeck.setSelectionMode(0)
			for (let card of Object.values(this.gamedatas.resourceCardsOnTable)) {
				this.resourceDeck.addToStockWithId(card.type, card.id)
			}

			const reorderResourceDeckEl = $first('.ss-resource-reorder-deck')
			this.reorderResourceDeck = this.createResourceStock(reorderResourceDeckEl)
		},

		onScreenWidthChange() {
			this.players.assertPositions()
		},

		///////////////////////////////////////////////////
		//// Game & client states

		onEnteringState: function(stateName, args) {
			console.log('Entering state: ' + stateName, args)

			if (stateName === 'playerTurn') {
				// Display for all players
				const leftStr = dojo.string.substitute(_('(${n} left)'), {
					n: args.args.actions
				})
				this.gamedatas.gamestate.descriptionmyturn += ' ' + leftStr
				this.gamedatas.gamestate.description += ' ' + leftStr
				this.updatePageTitle()
				return
			}

			// Now, only for active player
			if (!this.isCurrentPlayerActive()) {
				return
			}

			switch (stateName) {
				case 'playerMove':
					this.doPlayerActionMove(args.args.possibleDestinations)
					break
				case 'playerScavengePickCards':
					this.doPlayerPickResources(args.args.possibleSources)
					break
				case 'playerDiscardResources':
					this.doPlayerActionDiscardResource()
					break
				case 'playerRepair':
					this.doPlayerActionRepair()
					break
				case 'playerDivert':
					this.doPlayerActionDivert()
					break
				case 'playerRoomCrewQuarter':
					this.doPlayerRoomCrewQuarter()
					break
				case 'playerRoomCargoHold':
					this.doPlayerRoomCargoHold(Object.values(args.args._private.resourceCards))
					break
				case 'playerRoomEngineRoom':
					this.doPlayerRoomEngineRoom(args.args.resourceCards)
					break
				case 'playerRoomRepairCentre':
					this.doPlayerRoomRepairCentre()
					break
				case 'playerRoomArmoury':
					this.doPlayerRoomArmoury()
					break
				case 'playerRoomBridge':
					this.doPlayerRoomBridge(Object.values(args.args._private.damageCards))
					break
				case 'pickResources':
					this.doPlayerPickResources(args.args.possibleSources)
					break
			}
		},

		onLeavingState: function(stateName) {
			console.log('Leaving state: ' + stateName)

			switch (stateName) {
			}
		},

		onUpdateActionButtons: function(stateName, args) {
			console.log('onUpdateActionButtons: ' + stateName, args)

			if (this.isCurrentPlayerActive()) {
				const player = this.players.getActive()
				switch (stateName) {
					case 'playerTurn':
						this.addActionButton('buttonMove', _('Move'), evt => {
							this.onPlayerChooseAction(evt, 'move')
						})
						this.addActionButton('buttonScavenge', _('Scavenge'), evt => {
							this.onPlayerChooseAction(evt, 'scavenge')
						})
						this.addActionButton('buttonShare', _('Share'), evt => {
							this.onPlayerChooseAction(evt, 'share')
						})
						this.addActionButton('buttonRepair', _('Repair'), evt => {
							this.onPlayerChooseAction(evt, 'repair')
						})
						this.addActionButton('buttonRoom', _('Room action'), evt => {
							this.onPlayerChooseAction(evt, 'room')
						})
						this.addActionButton('buttonDivert', _('Divert'), evt => {
							this.onPlayerChooseAction(evt, 'divert')
						})
						this.addActionButton('buttonToken', _('Take action token'), evt => {
							this.onPlayerChooseAction(evt, 'token')
						})
						if (player.actionsTokens > 0) {
							this.addActionButton('buttonUseToken', _('Use action token'), evt => {
								this.ajaxAction('useToken', { lock: true })
							})
						}
						break
					case 'playerShare':
						this.addActionButton('shareGive', _('Give a card'), evt => {
							this.doPlayerActionGiveResource(true)
						})
						this.addActionButton('shareTake', _('Take a card'), evt => {
							this.doPlayerActionTakeResource(true)
						})
						break
					case 'playerScavenge':
						this.addActionButton('buttonRollDice', _('Roll dice'), evt => {
							this.ajaxAction('rollDice', { lock: true })
						})
						this.showActionCancelButton(() => {
							this.ajaxAction('cancel', { lock: true })
						})
						break
					case 'playerRoomMessHall':
						this.addActionButton('messHallGive', _('Give a card'), evt => {
							this.doPlayerActionGiveResource(false)
						})
						this.addActionButton('messHallTake', _('Take a card'), evt => {
							this.doPlayerActionTakeResource(false)
						})
						this.addActionButton('messHallSwap', _('Swap a card'), evt => {
							this.doPlayerActionSwapResource()
						})
						break
				}
			}
		},

		showActionCancelButton(callback) {
			this.removeActionCancelButton()
			this.addActionButton('actionCancelButton', _('Cancel'), callback, null, null, 'gray')
		},

		removeActionCancelButton() {
			const el = $('actionCancelButton')
			if (el) {
				el.remove()
			}
		},

		///////////////////////////////////////////////////
		//// Utility methods

		createResourceStock(el) {
			const stock = new ebg.stock()
			stock.create(this, el, 72, 100)
			stock.setSelectionMode(1)
			stock.extraClasses = 'ss-resource-card'
			stock.setSelectionAppearance('class')
			this.resourceTypes.forEach((type, index) => {
				stock.addItemType(type.id, index, g_gamethemeurl + 'img/resources.jpg', index)
			})
			return stock
		},

		createDamageStock(el) {
			const stock = new ebg.stock()
			stock.create(this, el, 160, 117)
			stock.setSelectionMode(1)
			stock.extraClasses = 'ss-damage-card'
			stock.setSelectionAppearance('class')
			for (let i = 0; i < 24; i++) {
				stock.addItemType(i, 1, g_gamethemeurl + 'img/damages.jpg', i + 1)
			}
			return stock
		},

		highlightEl(el, value) {
			if (typeof el === 'string') {
				el = $first(el)
			}
			el.classList[value ? 'add' : 'remove']('ss-highlight')
		},

		setVisibleEl(el, value) {
			if (typeof el === 'string') {
				el = $first(el)
			}
			el.classList[value ? 'add' : 'remove']('ss-visible')
		},

		connectStockCardClick(stock, callback) {
			return dojo.connect(stock, 'onChangeSelection', () => {
				const cards = stock.getSelectedItems()
				const card = cards[0]
				if (card) {
					stock.unselectAll()
					callback(card)
				}
			})
		},

		waitForResourceFromDeck(options = {}) {
			// Default options
			options = Object.assign({ table: true, deck: true, cancel: false }, options)

			return new Promise((resolve, reject) => {
				const handles = []
				const types = ['table', 'deck']

				const cleanAll = () => {
					// De-Highlight
					types.forEach(type => {
						this.highlightEl(`.ss-resource-deck__${type}`, false)
					})
					handles.forEach(handle => dojo.disconnect(handle))
					this.resourceDeck.setSelectionMode(0)
					this.removeActionCancelButton()
				}
				// Highlight
				types.forEach(type => {
					this.highlightEl(`.ss-resource-deck__${type}`, options[type])
				})

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				// Wait for click
				if (options.table) {
					this.resourceDeck.setSelectionMode(1)
					handles.push(
						this.connectStockCardClick(this.resourceDeck, card => {
							cleanAll()
							resolve(card)
						})
					)
				}
				if (options.deck) {
					handles.push(
						dojo.connect($first('.ss-resource-deck__source'), 'onclick', () => {
							cleanAll()
							resolve({ id: 9999 })
						})
					)
				}
			})
		},

		waitForPlayerResource(players, options = {}) {
			// Default options
			options = Object.assign({ cancel: false }, options)

			const ids = players.map(p => p.id)
			this.players.highlightHands(ids)

			return new Promise((resolve, reject) => {
				const handles = []
				const cleanAll = () => {
					this.players.highlightHands(null)
					handles.forEach(handle => dojo.disconnect(handle))
					players.forEach(player => {
						player.stock.setSelectionMode(0)
					})
					if (options.cancel) {
						this.removeActionCancelButton()
					}
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				players.forEach(player => {
					player.stock.setSelectionMode(1)
					handles.push(
						this.connectStockCardClick(player.stock, card => {
							cleanAll()
							resolve({ card, player })
						})
					)
				})
			})
		},

		waitForPlayerResources(options = {}) {
			// Default options
			options = Object.assign({ count: 1, cancel: false }, options)

			return new Promise((resolve, reject) => {
				const handles = []
				const player = this.players.getActive()
				player.highlightHand(true)

				const cleanAll = () => {
					player.highlightHand(false)
					player.stock.setSelectionMode(0)
					handles.forEach(handle => dojo.disconnect(handle))
					this.removeActionCancelButton()
					$('buttonAccept').remove()
				}

				player.stock.setSelectionMode(2)
				this.addActionButton('buttonAccept', _('Accept'), () => {
					const cards = player.stock.getSelectedItems()
					if (cards.length !== options.count) {
						gameui.showMessage(_(`You must select ${options.count} cards`), 'error')
						return
					}
					cleanAll()
					resolve(cards)
				})

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

			})
		},

		waitForRoomClick(rooms, options = {}) {
			// Default options
			options = Object.assign({ cancel: false }, options)

			const positions = rooms.map(r => r.position)
			this.rooms.highlightPositions(positions)

			return new Promise((resolve, reject) => {
				const handles = []
				const cleanAll = () => {
					handles.forEach(handle => dojo.disconnect(handle))
					if (options.cancel) {
						this.removeActionCancelButton()
					}
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
						this.rooms.highlightPositions(null)
					})
				}

				rooms.forEach(room => {
					handles.push(
						dojo.connect(room.el, 'onclick', () => {
							this.rooms.highlightPositions(null)
							cleanAll()
							resolve(room)
						})
					)
				})
			})
		},

		waitForPlayerMeepleClick(players, options = {}) {
			// Default options
			options = Object.assign({ cancel: false }, options)

			const ids = players.map(p => p.id)
			this.players.highlightMeeples(ids)

			return new Promise((resolve, reject) => {
				const handles = []
				const cleanAll = () => {
					handles.forEach(handle => dojo.disconnect(handle))
					this.removeActionCancelButton()
					this.players.highlightMeeples(null)
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				players.forEach(player => {
					handles.push(
						dojo.connect(player.meepleEl, 'onclick', () => {
							cleanAll()
							resolve(player)
						})
					)
				})
			})
		},

		waitForResourceCardFromDialog(cards, options = {}) {
			// Default options
			options = Object.assign({ cancel: false, title: '' }, options)

			return new Promise((resolve, reject) => {
				const handles = []
				const dialogEl = $first('.ss-resource-reorder-dialog')
				const cleanAll = () => {
					handles.forEach(handle => dojo.disconnect(handle))
					this.setVisibleEl(dialogEl, false)
					this.removeActionCancelButton()
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				this.reorderResourceDeck.unselectAll()
				this.reorderResourceDeck.removeAll()

				$first('.ss-resource-reorder-dialog__title').innerHTML = options.title
				this.setVisibleEl(dialogEl, true)
				for (let card of Object.values(cards)) {
					this.reorderResourceDeck.addToStockWithId(card.type, card.id)
				}

				this.reorderResourceDeck.setSelectionMode(1)
				handles.push(
					this.connectStockCardClick(this.reorderResourceDeck, card => {
						cleanAll()
						resolve(card)
					})
				)
			})
		},

		waitForResourceCardOrderFromDialog(cards, options = {}) {
			// Default options
			options = Object.assign({ cancel: false, count: cards.length, title: '' }, options)

			return new Promise((resolve, reject) => {
				let selectedCards = []
				const handles = []
				const dialogEl = $first('.ss-resource-reorder-dialog')
				const cleanAll = () => {
					handles.forEach(handle => dojo.disconnect(handle))
					this.setVisibleEl(dialogEl, false)
					this.removeActionCancelButton()
					$('buttonAccept').remove()
					$('buttonReset').remove()
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				this.reorderResourceDeck.unselectAll()
				this.reorderResourceDeck.removeAll()

				$first('.ss-resource-reorder-dialog__title').innerHTML = options.title
				this.setVisibleEl(dialogEl, true)
				for (let card of Object.values(cards)) {
					this.reorderResourceDeck.addToStockWithId(card.type, card.id)
				}

				this.reorderResourceDeck.setSelectionMode(2)
				this.addActionButton('buttonReset', _('Restart selection'), () => {
					selectedCards.forEach(card => {
						this.reorderResourceDeck.addToStockWithId(card.type, card.id)
					})
					selectedCards = []
				})
				this.addActionButton('buttonAccept', _('Accept'), () => {
					if (selectedCards.length !== options.count) {
						gameui.showMessage(_(`You must select ${options.count} cards`), 'error')
						return
					}
					cleanAll()
					resolve(selectedCards)
				})
				this.reorderResourceDeck.setSelectionMode(1)
				handles.push(
					this.connectStockCardClick(this.reorderResourceDeck, card => {
						selectedCards.push(card)
						this.reorderResourceDeck.removeFromStockById(card.id)
					})
				)
			})
		},

		waitForDamageCardOrderFromDialog(cards, options = {}) {
			// Default options
			options = Object.assign({ cancel: false, count: cards.length, title: '' }, options)

			return new Promise((resolve, reject) => {
				let selectedCards = []
				const handles = []
				const dialogEl = $first('.ss-damage-reorder-dialog')
				const cleanAll = () => {
					handles.forEach(handle => dojo.disconnect(handle))
					this.setVisibleEl(dialogEl, false)
					this.removeActionCancelButton()
					$('buttonAccept').remove()
					$('buttonReset').remove()
				}

				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}

				this.reorderDamageDeck.unselectAll()
				this.reorderDamageDeck.removeAll()

				$first('.ss-damage-reorder-dialog__title').innerHTML = options.title
				this.setVisibleEl(dialogEl, true)
				for (let card of Object.values(cards)) {
					this.reorderDamageDeck.addToStockWithId(card.type, card.id)
				}

				this.reorderDamageDeck.setSelectionMode(2)
				this.addActionButton('buttonReset', _('Restart selection'), () => {
					selectedCards.forEach(card => {
						this.reorderDamageDeck.addToStockWithId(card.type, card.id)
					})
					selectedCards = []
				})
				this.addActionButton('buttonAccept', _('Accept'), () => {
					if (selectedCards.length !== options.count) {
						gameui.showMessage(_(`You must select ${options.count} cards`), 'error')
						return
					}
					cleanAll()
					resolve(selectedCards)
				})
				this.reorderDamageDeck.setSelectionMode(1)
				handles.push(
					this.connectStockCardClick(this.reorderDamageDeck, card => {
						selectedCards.push(card)
						this.reorderDamageDeck.removeFromStockById(card.id)
					})
				)
			})
		},

		waitForResourceType(options = {}) {
			// Default options
			options = Object.assign({ cancel: false }, options)

			const cleanAll = () => {
				this.removeActionButtons()
			}

			return new Promise((resolve, reject) => {
				this.resourceTypes
					.filter(r => r.id !== 'universal')
					.forEach(resourceType => {
						this.addActionButton(`buttonResourceType__${resourceType.id}`, resourceType.name, () => {
							cleanAll()
							resolve(resourceType)
						})
					})
				if (options.cancel) {
					this.showActionCancelButton(() => {
						cleanAll()
						reject('CANCEL BTN')
					})
				}
			})
		},

		///////////////////////////////////////////////////
		//// Player's action

		ajaxAction(action, args, check = true) {
			console.log('ajaxAction', action, args, check)
			if (check & !this.checkAction(action)) {
				return
			}
			return new Promise((resolve, reject) => {
				this.ajaxcall(
					`/solarstorm/solarstorm/${action}.html`,
					args,
					this,
					function(result) {
						resolve(result)
					},
					function(is_error) {
						reject(is_error)
					}
				)
			})
		},

		onPlayerChooseAction(evt, action) {
			dojo.stopEvent(evt)
			this.ajaxAction('choose', { lock: true, actionName: action })
		},

		async doPlayerActionMove(possibleDestinations) {
			try {
				const rooms = possibleDestinations.map(p => this.rooms.getByPosition(p))
				const room = await this.waitForRoomClick(rooms, { cancel: true })
				await this.ajaxAction('move', { lock: true, position: room.position })
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerActionDiscardResource() {
			const card = (await this.waitForPlayerResource([this.players.getActive()])).card
			await this.ajaxAction('discardResource', { lock: true, cardId: card.id })
		},

		async doPlayerActionGiveResource(sameRoomOnly = true) {
			this.gamedatas.gamestate.descriptionmyturn = _('You mush choose a card to give')
			this.updatePageTitle()
			this.removeActionButtons()
			try {
				const activePlayer = this.players.getActive()
				const card = (await this.waitForPlayerResource([activePlayer], { cancel: true })).card
				this.gamedatas.gamestate.descriptionmyturn = _('You mush choose a player to give the card to')
				this.updatePageTitle()
				this.removeActionButtons()
				const targetPlayers = this.players
					.getInactive()
					.filter(p => !sameRoomOnly || p.position === activePlayer.position)
				const player = (await this.waitForPlayerResource(targetPlayers, { cancel: true })).player
				await this.ajaxAction('giveResourceToAnotherPlayer', {
					lock: true,
					cardId: card.id,
					playerId: player.id
				})
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerActionTakeResource(sameRoomOnly = true) {
			this.gamedatas.gamestate.descriptionmyturn = _('You mush choose a card to take')
			this.updatePageTitle()
			this.removeActionButtons()
			try {
				const activePlayer = this.players.getActive()
				const targetPlayers = this.players
					.getInactive()
					.filter(p => !sameRoomOnly || p.position === activePlayer.position)
				const card = (await this.waitForPlayerResource(targetPlayers, { cancel: true })).card
				await this.ajaxAction('pickResourceFromAnotherPlayer', {
					lock: true,
					cardId: card.id
				})
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerActionSwapResource() {
			this.gamedatas.gamestate.descriptionmyturn = _('Swap cards : You mush choose a card to give')
			this.updatePageTitle()
			this.removeActionButtons()
			try {
				const card1 = (await this.waitForPlayerResource([this.players.getActive()], { cancel: true })).card
				this.gamedatas.gamestate.descriptionmyturn = _('Swap cards : You mush choose a card to exchange')
				this.updatePageTitle()
				this.removeActionButtons()
				const card2 = (await this.waitForPlayerResource(this.players.getInactive(), { cancel: true })).card
				await this.ajaxAction('swapResourceWithAnotherPlayer', {
					lock: true,
					cardId: card1.id,
					card2Id: card2.id
				})
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerActionRepair() {
			try {
				const card = (await this.waitForPlayerResource([this.players.getActive()], { cancel: true })).card
				let resourceTypeId = null
				if (card.type === 'universal') {
					resourceTypeId = (await this.waitForResourceType({ cancel: true })).id
				}
				await this.ajaxAction('selectResourceForRepair', {
					lock: true,
					cardId: card.id,
					resourceType: resourceTypeId
				})
			} catch (e) {
				console.error(e)
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerActionDivert() {
			try {
				const cards = (await this.waitForPlayerResources({ count: 3, cancel: true }))
				await this.ajaxAction('selectResourcesForDivert', {
					lock: true,
					cardIds: cards.map(c => c.id).join(',')
				})
			} catch (e) {
				console.error(e)
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerRoomCargoHold(cards) {
			const selectedCards = await this.waitForResourceCardOrderFromDialog(cards, {
				title:
					_('Reorder the next resource cards.') +
					'<br/>' +
					'The first ones you select will be on <b>top</b> of the deck.',
				cancel: false
			})
			await this.ajaxAction('putBackResourceCardsInDeck', {
				lock: true,
				cardIds: selectedCards.map(c => c.id).join(',')
			})
		},

		async doPlayerRoomBridge(cards) {
			const selectedCards = await this.waitForDamageCardOrderFromDialog(cards, {
				title:
					_('Reorder the next damage cards.') +
					'<br/>' +
					'The first ones you select will be on <b>top</b> of the deck.',
				cancel: false
			})
			await this.ajaxAction('putBackDamageCardsInDeck', {
				lock: true,
				cardIds: selectedCards.map(c => c.id).join(',')
			})
		},

		async doPlayerRoomCrewQuarter() {
			try {
				const player = await this.waitForPlayerMeepleClick(this.players.players, { cancel: true })
				this.gamedatas.gamestate.descriptionmyturn = _('Crew Quarters: You mush choose a destination')
				this.updatePageTitle()
				this.removeActionButtons()
				// Valid rooms are where there are meeples
				const validRooms = this.players.players.map(p => p.position).map(p => this.rooms.getByPosition(p))
				const room = await this.waitForRoomClick(validRooms, { cancel: true })
				await this.ajaxAction('moveMeepleToRoom', {
					lock: true,
					playerId: player.id,
					position: room.position
				})
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		// TODO check server side discard/hand are not empty
		async doPlayerRoomEngineRoom(cards) {
			try {
				const card = await this.waitForResourceCardFromDialog(cards, {
					title: _('Select a card from the discard, to be swapped with one from your hand'),
					cancel: true
				})
				const card2 = (await this.waitForPlayerResource([this.players.getActive()], { cancel: true })).card
				await this.ajaxAction('swapResourceFromDiscard', {
					lock: true,
					cardId: card.id,
					card2Id: card2.id
				})
			} catch (e) {
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		// TODO check player has any resource card
		async doPlayerRoomRepairCentre() {
			try {
				const room = await this.waitForRoomClick(this.rooms.rooms, { cancel: true })
				this.gamedatas.gamestate.descriptionmyturn = dojo.string.substitute(
					_('Repair Centre: You mush choose a resource to repair: ${room}'),
					{ room: room.name }
				)
				this.updatePageTitle()
				this.removeActionButtons()
				const card = (await this.waitForPlayerResource([this.players.getActive()], { cancel: true })).card
				let resourceTypeId = null
				if (card.type === 'universal') {
					resourceTypeId = (await this.waitForResourceType({ cancel: true })).id
				}
				await this.ajaxAction('selectResourceForRepair', {
					lock: true,
					cardId: card.id,
					position: room.position,
					resourceType: resourceTypeId
				})
			} catch (e) {
				console.error(e)
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		// TODO alert if there is only one token left ?
		async doPlayerRoomArmoury() {
			try {
				const validRooms = this.rooms.rooms.filter(r => r.slug !== 'energy-core')
				const room = await this.waitForRoomClick(validRooms, { cancel: false })
				await this.ajaxAction('putProtectionToken', {
					lock: true,
					position: room.position,
				})
			} catch (e) {
				console.error(e)
				await this.ajaxAction('cancel', { lock: true })
			}
		},

		async doPlayerPickResources(possibleSources) {
			const card = await this.waitForResourceFromDeck({
				cancel: false,
				deck: possibleSources.includes('deck'),
				table: possibleSources.includes('table')
			})
			await this.ajaxAction('pickResource', { lock: true, cardId: card.id })
		},

		///////////////////////////////////////////////////
		//// Reaction to cometD notifications

		/*
            setupNotifications:

            In this method, you associate each of your game notifications with your local method to handle it.

            Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
                  your solarstorm.game.php file.

        */
		setupNotifications: function() {
			dojo.subscribe('updateRooms', this, 'notif_updateRooms')
			dojo.subscribe('updateDamageDiscard', this, 'notif_updateDamageDiscard')
			dojo.subscribe('addResourcesCardsOnTable', this, 'notif_addResourcesCardsOnTable')
			dojo.subscribe('updatePlayerData', this, 'notif_updatePlayerData')
			dojo.subscribe('playerPickResource', this, 'notif_playerPickResource')
			dojo.subscribe('playerDiscardResource', this, 'notif_playerDiscardResource')
			dojo.subscribe('playerShareResource', this, 'notif_playerShareResource')
			dojo.subscribe('putBackResourcesCardInDeck', this, 'notif_putBackResourcesCardInDeck')
		},

		notif_updateRooms(notif) {
			console.log('notif_updateRooms', notif)
			notif.args.rooms.forEach(roomData => {
				const room = this.rooms.getBySlug(roomData.slug)
				room.setDamage(roomData.damage)
				room.setDiverted(roomData.diverted)
				room.setProtection(roomData.protection)
			})
		},

		notif_updateDamageDiscard(notif) {
			console.log('notif_updateDamageDiscard', notif)
			notif.args.cards.forEach(cardData => {
				this.damageDeck.addToStock(cardData.type)
			})
			// TODO update damageCardsNbr
		},

		notif_addResourcesCardsOnTable(notif) {
			console.log('notif_addResourcesCardsOnTable', notif)
			notif.args.cards.forEach(cardData => {
				this.resourceDeck.addToStockWithId(cardData.type, cardData.id)
			})
			// TODO update damageCardsNbr
		},

		notif_playerPickResource(notif) {
			console.log('notif_playerPickResource', notif)
			const card = notif.args.card
			this.resourceDeck.removeFromStockById(card.id)
			const player = this.players.getPlayerById(notif.args.player_id)
			player.stock.addToStockWithId(card.type, card.id)
			// TODO animation
		},

		notif_playerDiscardResource(notif) {
			console.log('notif_playerDiscardResource', notif)
			const card = notif.args.card
			const player = this.players.getPlayerById(notif.args.player_id)
			player.stock.removeFromStockById(card.id)
			// TODO animation
		},

		notif_playerShareResource(notif) {
			console.log('notif_playerShareResource', notif)
			const card = notif.args.card
			const player = this.players.getPlayerById(notif.args.player_id)
			if (notif.args.shareAction === 'take') {
				const fromPlayer = this.players.getPlayerById(notif.args.from_player_id)
				fromPlayer.stock.removeFromStockById(card.id)
				player.stock.addToStockWithId(card.type, card.id)
			} else {
				const toPlayer = this.players.getPlayerById(notif.args.to_player_id)
				player.stock.removeFromStockById(card.id)
				toPlayer.stock.addToStockWithId(card.type, card.id)
			}
			// TODO animation
		},

		notif_putBackResourcesCardInDeck(notif) {
			console.log('notif_putBackResourcesCardInDeck', notif)
			const card = notif.args.card
			this.reorderResourceDeck.removeFromStockById(card.id, $first('.ss-resource-deck__deck'))
		},

		notif_updatePlayerData(notif) {
			console.log('notif_updatePlayerData', notif)
			const player = this.players.getPlayerById(notif.args.player_id)
			player.setRoomPosition(notif.args.position)
			player.setActionsTokens(notif.args.actionsTokens)
		}
	})
})

class SSRooms {
	rooms = []

	addRoom(room) {
		this.rooms.push(room)
	}

	getByEl(el) {
		return this.rooms.find(r => r.el === el)
	}

	getBySlug(slug) {
		return this.rooms.find(r => r.slug === slug)
	}

	getByPosition(position) {
		return this.rooms.find(r => r.position === position)
	}

	highlightPositions(positions) {
		this.rooms.forEach(room => {
			room.highlight(positions && positions.includes(room.position))
		})
	}
}

class SSRoom {
	gameObject = null
	id = null
	slug = null
	name = null
	description = null
	position = null
	damage = [false, false, false]
	diverted = false
	protection = []

	el = null
	divertedTokenEl = null

	constructor(gameObject, data) {
		this.gameObject = gameObject
		this.id = data.id
		this.slug = data.slug
		this.name = data.name
		this.description = data.description
		this.position = data.position
		this.assertEl()
		this.setDamage(data.damage)
		this.setDiverted(data.diverted)
		this.setProtection(data.protection)
	}

	assertEl() {
		let el = $first(`.ss-room--${this.id}`)
		if (el) {
			this.el = el
			return
		}
		const roomsEl = $first('.ss-rooms')
		el = dojo.create(
			'div',
			{
				id: `ss-room--${this.id}`,
				class: `ss-room ss-room--pos-${this.position} ss-room--${this.id}`
			},
			roomsEl
		)
		this.gameObject.addTooltipHtml(
			el.id,
			`<div class="ss-room ss-room-tooltip ss-room--${this.id}"></div><b>${this.name}</b><hr/>${this.description}`,
			1000
		)
		if (this.id !== 0) {
			for (let i = 0; i < 3; i++) {
				dojo.create('div', { class: `ss-room__damage ss-room__damage--${i}` }, el)
			}
			this.divertedTokenEl = dojo.create('div', { class: 'ss-room__diverted-token' }, el)
		}
		this.el = el
	}

	setDamage(damage) {
		if (this.id === 0) {
			return
		}
		damage.forEach((dmg, index) => {
			this.el.classList[dmg ? 'add' : 'remove'](`ss-room--damaged-${index}`)
		})
		this.damage = damage
	}

	setDiverted(diverted) {
		if (this.id === 0) {
			return
		}
		this.diverted = diverted
		this.gameObject.setVisibleEl(this.divertedTokenEl, diverted)
	}

	setProtection(protection) {
		if (this.id === 0) {
			return
		}
		if (!Array.isArray(protection)) {
			protection = []
		}
		// Assert numbers, and sort
		protection = protection.map(p => +p).sort()
		const doUpdate = protection.toString() !== this.protection.toString()
		this.protection = protection
		if (doUpdate) {
			this.updateProtectionTokens()
		}
	}

	updateProtectionTokens() {
		// Remove all
		dojo.query('.ss-protection-token', this.el).forEach(el => {
			el.remove()
			this.gameObject.removeTooltip(el.id)
		})
		// Add them
		let index = 0
		this.protection.forEach(playerId => {
			const id = `ss-protection-token--${this.position}-${index}`
			const player = this.gameObject.players.getPlayerById(playerId)
			if (!player) {
				return
			}
			const order = player.order
			dojo.create('div', { class: `ss-protection-token ss-protection-token--${order}`, id }, this.el)
			const tooltip = dojo.string.substitute(
				_(
					"Protection token put by ${player_name}.${newline}It will be removed when a damage is received on this room, or at the <b>start</b> of ${player_name}'s turn"
				),
				{ player_name: player.name, newline: '<br/>' }
			)
			this.gameObject.addTooltipHtml(id, tooltip, 250)
			index++
		})
	}

	highlight(value) {
		this.gameObject.highlightEl(this.el, value)
	}
}

class SSPlayers {
	gameObject = null
	players = []

	constructor(gameObject) {
		this.gameObject = gameObject
	}

	addPlayer(player) {
		this.players.push(player)
	}

	getPlayerById(id) {
		return this.players.find(p => p.id === +id)
	}

	// Return active player
	getActive() {
		return this.getPlayerById(+this.gameObject.getActivePlayerId())
	}

	// Return inactive players (array)
	getInactive() {
		return this.players.filter(p => p.id !== +this.gameObject.getActivePlayerId())
	}

	getAtPosition(position) {
		return this.players.filter(p => p.position === +position)
	}

	assertPositions() {
		this.players.forEach(player => {
			player.setRoomPosition(player.position, true, false)
		})
	}

	highlightHands(ids) {
		this.players.forEach(player => {
			player.highlightHand(ids && ids.includes(player.id))
		})
	}

	highlightMeeples(ids) {
		this.players.forEach(player => {
			player.highlightMeeple(ids === 'all' || (ids && ids.includes(player.id)))
		})
	}
}

class SSPlayer {
	gameObject = null
	id = null
	name = null
	color = null
	stock = null
	order = null
	position = null
	actionsTokens = 0
	boardEl = null
	meepleEl = null
	actionsTokensEl = null
	actionsTokensNumberEl = null

	constructor(gameObject, id, name, color, order, position, actionsTokens) {
		this.gameObject = gameObject
		this.id = +id
		this.name = name
		this.color = color
		this.order = order
		this.assertBoardEl()
		this.assertMeepleEl()
		this.createStock()
		this.setRoomPosition(position, false, true)
		this.setActionsTokens(actionsTokens)
	}

	isCurrentActive() {
		return this.gameObject.player_id == this.id && this.gameObject.getActivePlayerId() == this.id
	}

	assertBoardEl() {
		let boardEl = $first(`.ss-players-board--id-${this.id}`)
		if (boardEl) {
			this.boardEl = boardEl
			return
		}
		const playersHandsEl = $first('.ss-players-hands')
		boardEl = dojo.create('div', { class: `ss-player-board ss-players-board--id-${this.id}` }, playersHandsEl)
		this.boardEl = boardEl
		const nameEl = dojo.create(
			'div',
			{
				class: 'ss-player-board__name',
				style: { backgroundColor: '#' + this.color },
				innerHTML: `Hand of ${this.name}`
			},
			boardEl
		)
		this.handEl = dojo.create('div', { class: 'ss-player-hand', id: `ss-player-hand--${this.id}` }, this.boardEl)
		this.actionsTokensEl = dojo.create('div', { class: 'ss-player-board__action-tokens' }, boardEl)
		dojo.create('div', { class: 'ss-player-board__action-tokens__token ss-action-token' }, this.actionsTokensEl)
		this.actionsTokensNumberEl = dojo.create(
			'div',
			{ class: 'ss-player-board__action-tokens__number' },
			this.actionsTokensEl
		)
	}

	assertMeepleEl() {
		let meepleEl = $first(`.ss-player-meeple--id-${this.id}`)
		if (meepleEl) {
			this.meepleEl = meepleEl
			return
		}
		const playersArea = $first('.ss-play-area')
		meepleEl = dojo.create(
			'div',
			{
				id: `ss-player-meeple--id-${this.id}`,
				class: `ss-player-meeple ss-player-meeple--order-${this.order} ss-player-meeple--id-${this.id}`
			},
			playersArea
		)
		this.gameObject.addTooltipHtml(meepleEl.id, _(`Player ${this.name}`), 250)
		this.meepleEl = meepleEl
	}

	createStock() {
		this.stock = new ebg.stock()
		this.stock = this.gameObject.createResourceStock(this.handEl)
		this.stock.setOverlap(30, 5)
		this.gameObject.resourceTypes.forEach((type, index) => {
			this.stock.addItemType(type.id, index, g_gamethemeurl + 'img/resources.jpg', index)
		})
	}

	setRoomPosition(position, instant = false, moveOthers = true) {
		const previousPosition = this.position
		this.position = position
		if (position === null) {
			// this.meepleEl.style.display = 'none'
			return
		}
		this.meepleEl.style.display = 'block'

		const roomEl = this.gameObject.rooms.getByPosition(position).el
		const duration = instant ? 0 : 750
		const roomPos = dojo.position(roomEl)

		// const index = this.gameObject.players
		// .getAtPosition(position)
		// .sort(p => p.order)
		// .findIndex(p => p.id === this.id)
		const index = this.order
		const offsetX = index * 30 + 20
		const offsetY = roomPos.h * 0.2

		this.gameObject.slideToObjectPos(this.meepleEl, roomEl, offsetX, offsetY, duration, 0).play()

		if (moveOthers) {
			this.gameObject.players.getAtPosition(position).forEach(p => p.setRoomPosition(position, false, false))
			if (previousPosition !== position) {
				this.gameObject.players
					.getAtPosition(previousPosition)
					.forEach(p => p.setRoomPosition(previousPosition, false, false))
			}
		}
	}

	highlightHand(value) {
		this.gameObject.highlightEl(this.boardEl, value)
	}

	highlightMeeple(value) {
		this.gameObject.highlightEl(this.meepleEl, value)
	}

	setActionsTokens(value) {
		this.actionsTokens = value
		this.actionsTokensNumberEl.innerHTML = '×' + value
		this.gameObject.setVisibleEl(this.actionsTokensEl, value > 0)
	}
}
