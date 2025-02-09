function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

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
define(['dojo', 'dojo/_base/declare', 'ebg/core/gamegui', 'ebg/counter', 'ebg/stock'], function (dojo, declare) {
  return declare('bgagame.solarstorm', ebg.core.gamegui, {
    constructor: function () {
      // Marker : setup can be called more than once (undo method)
      this.initialized = false;
      this.rooms = new SSRooms();
      this.players = new SSPlayers(this);
      this.resourceTypes = [];
      this.damageDeck = null;
      this.resourceDeck = null;
      this.reorderResourceDeck = null;
      this.reorderDamageDeck = null;
      this.diceResultDialogTimeout = null;
    },
    setup: function (gamedatas) {
      this.resourceTypes = gamedatas.resourceTypes;
      this.initializePlayArea();
      this.initializePlayersArea();
      this.initializeDamageDeck();
      this.initializeResourceDeck();
      this.setupNotifications();
      this.initialized = true;
    },

    initializePlayArea() {
      // Initialize rooms
      this.rooms.removeAll();
      this.gamedatas.rooms.forEach(roomData => {
        const room = new SSRoom(this, roomData);
        this.rooms.addRoom(room);
      });

      if (!this.initialized) {
        const hoverRoomsForDamageCard = (el, value) => {
          const dataRooms = el.getAttribute('data-rooms');

          if (!dataRooms) {
            return;
          }

          const rooms = dataRooms.split(',').forEach(slug => {
            this.rooms.getBySlug(slug).highlightHover(value);
          });
        };

        document.addEventListener('mouseover', e => {
          if (e.target && e.target.classList && e.target.classList.contains('ss-room-name')) {
            const room = this.rooms.getBySlug(e.target.getAttribute('data-room'));
            room.highlightHover(true);
          }

          if (e.target && e.target.classList && e.target.classList.contains('ss-damage-card')) {
            hoverRoomsForDamageCard(e.target, true);
          }
        });
        document.addEventListener('mouseout', e => {
          if (e.target && e.target.classList && e.target.classList.contains('ss-room-name')) {
            const room = this.rooms.getBySlug(e.target.getAttribute('data-room'));
            room.highlightHover(false);
          }

          if (e.target && e.target.classList && e.target.classList.contains('ss-damage-card')) {
            hoverRoomsForDamageCard(e.target, false);
          }
        });
      }
    },

    initializePlayersArea() {
      this.players.removeAll();
      let playerIds = this.gamedatas.playerorder.map(id => parseInt(id, 10));

      if (!playerIds.includes(this.getCurrentPlayerId())) {
        // Observer mode, don't use "playerorder"
        playerIds = this.gamedatas.ssPlayers.map(p => p.id);
      }

      playerIds.forEach(id => {
        id = parseInt(id, 10);
        const data = this.gamedatas.ssPlayers.find(_ => _.id === id);
        const player = new SSPlayer(this, id, data.name, data.color, data.order, data.position, data.actionsTokens, this.prefs[101].value);
        this.players.addPlayer(player);
      });

      for (const [playerId, playerCards] of Object.entries(this.gamedatas.resourceCards)) {
        playerCards.forEach(resourceCard => {
          this.players.getPlayerById(playerId).stock.addToStockWithId(resourceCard.type, resourceCard.id);
        });
      }

      this.rooms.rooms.forEach(r => r.updateProtectionTokens());
    },

    initializeDamageDeck() {
      this.updateDamageCardsLeft(this.gamedatas.damageCardsNbr);
      const damageDeckEl = document.querySelector('.ss-damage-deck');
      this.damageDeck = this.createDamageStock(damageDeckEl);
      this.damageDeck.setOverlap(0.01);
      this.damageDeck.setSelectionMode(0);

      for (let card of Object.values(this.gamedatas.damageCardsDiscarded)) {
        this.damageDeck.addToStock(card.type);
      } // prettier-ignore


      const markdown = [_('Damage deck'), '.\n----\n', _("At the **end of turn** of each player, a new card is revealed, indicating rooms which are damaged.${newline}The deck is ordered like this :${newline}+ 8 damage cards with 1 room${newline}+ 8 damage cards with 2 rooms${newline}+ 8 damage cards with 3 rooms.${newline}When the deck is empty, the ship' hull starts taking damage, and resources will be discarded from the deck, accelerating the end of the game !"), '\n----\n', _('+ Note: at the start of the game, two damage cards are revealed from the bottom (applying 6 damages).${newline}+ Note 2: if a room has a *protection* token, instead of taking damage, the protection token is removed.')];
      this.addTooltipMarkdown(damageDeckEl, markdown.join(''), {}, 1000);
      const reorderDamageDeckEl = document.querySelector('.ss-damage-reorder-deck');
      this.reorderDamageDeck = this.createDamageStock(reorderDamageDeckEl);
    },

    initializeResourceDeck() {
      document.querySelector('.ss-resource-deck__title').innerHTML = '<span>' + _('Resource cards') + '</span>';
      const resourceDeckEl = document.querySelector('.ss-resource-deck__table');
      this.resourceDeck = this.createResourceStock(resourceDeckEl);
      this.resourceDeck.setOverlap(50);
      this.resourceDeck.setSelectionMode(0);

      for (let card of Object.values(this.gamedatas.resourceCardsOnTable)) {
        this.resourceDeck.addToStockWithId(card.type, card.id);
      }

      const reorderResourceDeckEl = document.querySelector('.ss-resource-reorder-deck');
      this.reorderResourceDeck = this.createResourceStock(reorderResourceDeckEl);
      this.reorderResourceDeck.setOverlap(30, 0); // prettier-ignore

      this.addTooltipMarkdown(document.querySelector('.ss-resource-deck__deck'), [_('Resource deck'), '.\n----\n', _('At the **end of their turn**, a player can pick either:${newline}+ 2 cards from this deck (*face down*),${newline}+ or 1 card among the 2 revealed.${newline}**Important :** When the resource deck is depleted, the game is instantly lost.${newline}${newline}At the start, there was a total of ${num} resources cards in this deck.')].join(''), {
        num: this.gamedatas.resourceCardsNbrInitial
      }, 1000);
      this.updateResourceCardsNbr(this.gamedatas.resourceCardsNbr);
    },

    onScreenWidthChange() {
      this.players.assertPositions();
    },

    ///////////////////////////////////////////////////
    //// Game & client states
    onEnteringState: function (stateName, args) {
      console.log('Entering state: ' + stateName, args); // Higlight active player

      this.players.highlightActive();

      if (!this.isCurrentPlayerActive()) {
        return;
      }

      switch (stateName) {
        case 'playerMove':
          this.doPlayerActionMove(args.args.possibleDestinations);
          break;

        case 'playerScavengePickCards':
          this.doPlayerPickResources(args.args.possibleSources);
          break;

        case 'playerDiscardResources':
          this.doPlayerActionDiscardResource(args.args.numCardsToDiscard, 'excess');
          break;

        case 'playerRepair':
          this.doPlayerActionRepair(args.args.possibleRepairs);
          break;

        case 'playerDivert':
          this.doPlayerActionDivert();
          break;

        case 'playerRoomCrewQuarter':
          this.doPlayerRoomCrewQuarter();
          break;

        case 'playerRoomCargoHold':
          this.doPlayerRoomCargoHold(Object.values(args.args._private.resourceCards));
          break;

        case 'playerRoomEngineRoom':
          this.doPlayerRoomEngineRoom(args.args.resourceCards);
          break;

        case 'playerRoomRepairCentre':
          this.doPlayerRoomRepairCentre();
          break;

        case 'playerRoomArmoury':
          const tokensLeft = args.args.tokensLeft;
          const tokensToPut = Math.min(2, tokensLeft);

          if (tokensLeft < 2) {
            this.multipleChoiceDialog(_('There is only one protection token left; are you sure you want to do this action ?'), [_('Yes'), _('Cancel')], choice => {
              if (choice == 0) {
                this.doPlayerRoomArmoury(tokensToPut);
              } else {
                this.ajaxAction('cancel', {
                  lock: true
                });
              }
            });
          } else {
            this.doPlayerRoomArmoury(tokensToPut);
          }

          break;

        case 'playerRoomBridge':
          this.doPlayerRoomBridge(Object.values(args.args._private.damageCards));
          break;

        case 'pickResources':
          this.doPlayerPickResources(args.args.possibleSources, args.args.canRestartTurn);
          break;
      }
    },
    onLeavingState: function (stateName) {
      console.log('Leaving state: ' + stateName);

      switch (stateName) {}
    },
    onUpdateActionButtons: function (stateName, args) {
      console.log('onUpdateActionButtons: ' + stateName, args);

      if (this.isCurrentPlayerActive()) {
        const player = this.players.getActive();

        switch (stateName) {
          case 'playerTurn':
            const possibles = args.possibleActions;
            this.addChooseActionButton('move', _('Move'), possibles.includes('move'));
            this.addChooseActionButton('scavenge', _('Scavenge'), possibles.includes('scavenge'));
            this.addChooseActionButton('share', _('Share'), possibles.includes('share'));
            this.addChooseActionButton('repair', _('Repair'), possibles.includes('repair'));
            this.addChooseActionButton('room', _('Room action'), possibles.includes('room'));
            this.addChooseActionButton('divert', _('Divert'), possibles.includes('divert'));
            this.addChooseActionButton('token', _('Take action token'), possibles.includes('token'));

            if (player.actionsTokens > 0 && args.canUseActionTokens) {
              this.addActionButton('buttonUseToken', _('Use action token'), evt => {
                this.ajaxAction('useToken', {
                  lock: true
                });
              });
            }

            if (args.canRestartTurn) {
              this.showRestartTurnButton(() => {
                this.ajaxAction('restartTurn', {
                  lock: true
                });
              });
            }

            break;

          case 'playerShare':
            this.addActionButton('shareGive', _('Give a card'), evt => {
              this.doPlayerActionGiveResource(true);
            });
            this.addActionButton('shareTake', _('Take a card'), evt => {
              this.doPlayerActionTakeResource(true);
            });
            break;

          case 'playerScavenge':
            this.addActionButton('buttonRollDice', _('Roll dice'), evt => {
              this.ajaxAction('rollDice', {
                lock: true
              });
            });
            this.showActionCancelButton(() => {
              this.ajaxAction('cancel', {
                lock: true
              });
            });
            break;

          case 'playerRoomMessHall':
            this.addActionButton('messHallGive', _('Give a card'), evt => {
              this.doPlayerActionGiveResource(false);
            });
            this.addActionButton('messHallTake', _('Take a card'), evt => {
              this.doPlayerActionTakeResource(false);
            });
            this.addActionButton('messHallSwap', _('Swap a card'), evt => {
              this.doPlayerActionSwapResource();
            });
            break;

          case 'playerAskActionTokensPlay':
            this.addActionButton('buttonUseToken', _('Use action token'), evt => {
              this.ajaxAction('useToken', {
                lock: true
              });
            });
            this.addActionButton('buttonDontUseToken', _('End turn'), evt => {
              this.ajaxAction('dontUseToken', {
                lock: true
              });
            });
            break;
        }
      }
    },

    showActionCancelButton(callback) {
      this.removeActionCancelButton();
      this.addActionButton('actionCancelButton', _('Cancel'), callback, null, null, 'gray');
    },

    addChooseActionButton(action, text, possible, faIcon) {
      if (!possible) {
        return;
      }

      const buttonId = 'button-' + (action === 'share' ? 'shares' : action);
      const iconHtml = faIcon ? "<i class=\"fa fa-" + faIcon + "\"></i> " : '';
      this.addActionButton(buttonId, iconHtml + text, evt => {
        this.onPlayerChooseAction(evt, action);
      }, null, null, possible ? 'blue' : 'gray');

      if (!possible) {
        $(buttonId).classList.add('ss-action-button--disabled');
      }
    },

    removeActionCancelButton() {
      const el = $('actionCancelButton');

      if (el) {
        el.remove();
      }
    },

    showRestartTurnButton(callback) {
      this.addActionButton('actionRestartTurn', _('Restart turn'), callback, null, null, 'gray');
    },

    removeRestartTurnButton() {
      const el = $('actionRestartTurn');

      if (el) {
        el.remove();
      }
    },

    updateDamageCardsLeft(nbr) {
      const text = _('Damage cards');

      const leftStr = dojo.string.substitute(_('${n} left'), {
        n: nbr
      });
      document.querySelector('.ss-damage-deck__title').innerHTML = "<span>" + text + " (" + leftStr + ")</span>";
    },

    ///////////////////////////////////////////////////
    //// Utility methods
    createResourceStock(el) {
      const stock = new ebg.stock();
      stock.create(this, el, 65, 90);
      stock.setSelectionMode(1);
      stock.extraClasses = 'ss-resource-card';
      stock.setSelectionAppearance('class');

      stock.onItemCreate = (el, id) => {
        const type = this.resourceTypes.find(r => r.id === id); // prettier-ignore

        this.addTooltipMarkdown(el, [_('Resource card of type: **${type}** ${detail}'), '\n----\n', _('Used to **repair** or **divert** power in the rooms.${newline}Maximum 6 cards in the player hand (at the end of turn).')].join(''), {
          type: _(type.nametr),
          detail: id === 'universal' ? _('(can be used as any other resource)') : ''
        }, 250);
        el.setAttribute('data-type', type.id);
      };

      this.resourceTypes.forEach((type, index) => {
        stock.addItemType(type.id, index, g_gamethemeurl + 'img/resources.jpg', index);
      });
      return stock;
    },

    createDamageStock(el) {
      const stock = new ebg.stock();
      stock.create(this, el, 123, 90);
      stock.setSelectionMode(1);
      stock.extraClasses = 'ss-damage-card';
      stock.setSelectionAppearance('class');

      for (let i = 0; i < 24; i++) {
        stock.addItemType(i, 1, g_gamethemeurl + 'img/damages.jpg', i + 1);
      }

      stock.addItemType('hull', 1, g_gamethemeurl + 'img/damages.jpg', 25);

      stock.onItemCreate = (el, id) => {
        if (id === 'hull') {
          // prettier-ignore
          this.addTooltipMarkdown(el, [_('Hull Breach Card !'), '\n----\n', _('This is the **last** card of the deck.${newline}At the end of a player turn, a die is rolled :${newline}+ 1 or 2: player must discard 1 resource card${newline}+ 3 or 4: player must discard 2 resource cards${newline}+ 5 or 6: player must discard 3 resource cards')].join(''), {}, 250);
          return;
        }

        const rooms = this.gamedatas.damageCardsInfos[id];
        el.setAttribute('data-rooms', rooms.join(','));
      };

      return stock;
    },

    highlightEl(el, value, cls = 'ss-highlight') {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }

      el.classList.toggle(cls, value);
    },

    setVisibleEl(el, value) {
      if (typeof el === 'string') {
        el = document.querySelector(el);
      }

      el.classList.toggle('ss-visible', value);
    },

    connectStockCardClick(stock, callback) {
      return dojo.connect(stock, 'onChangeSelection', () => {
        const cards = stock.getSelectedItems();
        const card = cards[0];

        if (card) {
          stock.unselectAll();
          callback(card);
        }
      });
    },

    waitForResourceFromDeck(options = {}) {
      // Default options
      options = Object.assign({
        table: true,
        deck: true,
        cancel: false,
        restart: false
      }, options);
      return new Promise((resolve, reject) => {
        const handles = [];
        const types = ['table', 'deck'];

        const cleanAll = () => {
          // De-Highlight
          types.forEach(type => {
            this.highlightEl(".ss-resource-deck__" + type, false);
          });
          handles.forEach(handle => dojo.disconnect(handle));
          this.resourceDeck.setSelectionMode(0);
          this.removeActionCancelButton();
          this.removeRestartTurnButton();
        }; // Highlight


        types.forEach(type => {
          this.highlightEl(".ss-resource-deck__" + type, options[type]);
        });

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        if (options.restart) {
          this.showRestartTurnButton(() => {
            cleanAll();
            reject('RESTART_BTN');
          });
        } // Wait for click


        if (options.table) {
          this.resourceDeck.setSelectionMode(1);
          handles.push(this.connectStockCardClick(this.resourceDeck, card => {
            cleanAll();
            resolve(card);
          }));
        }

        if (options.deck) {
          handles.push(dojo.connect(document.querySelector('.ss-resource-deck__source'), 'onclick', () => {
            cleanAll();
            resolve({
              id: 9999
            });
          }));
        }
      });
    },

    waitForPlayerResource(players, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false,
        resourceTypes: null
      }, options);
      const ids = players.map(p => p.id);
      this.players.highlightHands(ids, options.resourceTypes);
      return new Promise((resolve, reject) => {
        const handles = [];

        const cleanAll = () => {
          this.players.highlightHands(null);
          handles.forEach(handle => dojo.disconnect(handle));
          players.forEach(player => {
            player.stock.setSelectionMode(0);
          });

          if (options.cancel) {
            this.removeActionCancelButton();
          }
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        players.forEach(player => {
          player.stock.setSelectionMode(1);
          handles.push(this.connectStockCardClick(player.stock, card => {
            cleanAll();
            resolve(card);
          }));
        });
      });
    },

    waitForPlayerSelection(players, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false
      }, options);
      const ids = players.map(p => p.id);
      this.players.highlightBoards(ids);
      return new Promise((resolve, reject) => {
        const handles = [];

        const cleanAll = () => {
          this.players.highlightBoards(null);
          handles.forEach(handle => dojo.disconnect(handle));

          if (options.cancel) {
            this.removeActionCancelButton();
          }
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        players.forEach(player => {
          handles.push(dojo.connect(player.boardEl, 'onclick', () => {
            cleanAll();
            resolve(player);
          }));
        });
      });
    },

    waitForPlayerResources(options = {}) {
      // Default options
      options = Object.assign({
        count: 1,
        cancel: false,
        btnText: _('Accept')
      }, options);
      return new Promise((resolve, reject) => {
        const handles = [];
        const player = this.players.getActive();
        player.highlightHand(true);

        const cleanAll = () => {
          player.highlightHand(false);
          player.stock.setSelectionMode(0);
          handles.forEach(handle => dojo.disconnect(handle));
          this.removeActionCancelButton();
          $('buttonAccept').remove();
        };

        player.stock.setSelectionMode(2);
        this.addActionButton('buttonAccept', options.btnText, () => {
          const cards = player.stock.getSelectedItems();

          if (cards.length !== options.count) {
            gameui.showMessage(dojo.string.substitute(_('You must select ${num} cards'), {
              num: options.count
            }), 'error');
            return;
          }

          cleanAll();
          resolve(cards);
        });

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }
      });
    },

    waitForRoomClick(rooms, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false
      }, options);
      const positions = rooms.map(r => r.position);
      this.rooms.highlightPositions(positions);
      return new Promise((resolve, reject) => {
        const handles = [];

        const cleanAll = () => {
          handles.forEach(handle => dojo.disconnect(handle));

          if (options.cancel) {
            this.removeActionCancelButton();
          }
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
            this.rooms.highlightPositions(null);
          });
        }

        rooms.forEach(room => {
          handles.push(dojo.connect(room.el, 'onclick', () => {
            this.rooms.highlightPositions(null);
            cleanAll();
            resolve(room);
          }));
        });
      });
    },

    waitForPlayerMeepleClick(players, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false
      }, options);
      const ids = players.map(p => p.id);
      this.players.highlightMeeples(ids);
      return new Promise((resolve, reject) => {
        const handles = [];

        const cleanAll = () => {
          handles.forEach(handle => dojo.disconnect(handle));
          this.removeActionCancelButton();
          this.players.highlightMeeples(null);
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        players.forEach(player => {
          handles.push(dojo.connect(player.meepleEl, 'onclick', () => {
            cleanAll();
            resolve(player);
          }));
        });
      });
    },

    waitForResourceCardFromDialog(cards, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false,
        title: ''
      }, options);
      return new Promise((resolve, reject) => {
        const handles = [];
        const dialogEl = document.querySelector('.ss-resource-reorder-dialog');

        const cleanAll = () => {
          handles.forEach(handle => dojo.disconnect(handle));
          this.setVisibleEl(dialogEl, false);
          this.removeActionCancelButton();
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        this.reorderResourceDeck.unselectAll();
        this.reorderResourceDeck.removeAll();
        document.querySelector('.ss-resource-reorder-dialog__title').innerHTML = options.title;
        this.setVisibleEl(dialogEl, true);

        for (let card of Object.values(cards)) {
          this.reorderResourceDeck.addToStockWithId(card.type, card.id);
        }

        this.reorderResourceDeck.setSelectionMode(1);
        handles.push(this.connectStockCardClick(this.reorderResourceDeck, card => {
          cleanAll();
          resolve(card);
        }));
      });
    },

    waitForResourceCardOrderFromDialog(cards, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false,
        count: cards.length,
        title: ''
      }, options);
      return new Promise((resolve, reject) => {
        let selectedCards = [];
        const handles = [];
        const dialogEl = document.querySelector('.ss-resource-reorder-dialog');

        const cleanAll = () => {
          handles.forEach(handle => dojo.disconnect(handle));
          this.setVisibleEl(dialogEl, false);
          this.removeActionCancelButton();
          $('buttonAccept').remove();
          $('buttonReset').remove();
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        this.reorderResourceDeck.unselectAll();
        this.reorderResourceDeck.removeAll();
        document.querySelector('.ss-resource-reorder-dialog__title').innerHTML = options.title;
        this.setVisibleEl(dialogEl, true);

        for (let card of Object.values(cards)) {
          this.reorderResourceDeck.addToStockWithId(card.type, card.id);
        }

        this.reorderResourceDeck.setSelectionMode(2);
        this.addActionButton('buttonReset', _('Restart selection'), () => {
          selectedCards.forEach(card => {
            this.reorderResourceDeck.addToStockWithId(card.type, card.id);
          });
          selectedCards = [];
        });
        this.addActionButton('buttonAccept', _('Accept'), () => {
          if (selectedCards.length !== options.count) {
            gameui.showMessage(dojo.string.substitute(_('You must select ${num} cards'), {
              num: options.count
            }), 'error');
            return;
          }

          cleanAll();
          resolve(selectedCards);
        });
        this.reorderResourceDeck.setSelectionMode(1);
        handles.push(this.connectStockCardClick(this.reorderResourceDeck, card => {
          selectedCards.push(card);
          this.reorderResourceDeck.removeFromStockById(card.id);
        }));
      });
    },

    waitForDamageCardOrderFromDialog(cards, options = {}) {
      // Default options
      options = Object.assign({
        cancel: false,
        count: cards.length,
        title: ''
      }, options);
      return new Promise((resolve, reject) => {
        let selectedCards = [];
        const handles = [];
        const dialogEl = document.querySelector('.ss-damage-reorder-dialog');

        const cleanAll = () => {
          handles.forEach(handle => dojo.disconnect(handle));
          this.setVisibleEl(dialogEl, false);
          this.removeActionCancelButton();
          $('buttonAccept').remove();
          $('buttonReset').remove();
        };

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }

        this.reorderDamageDeck.unselectAll();
        this.reorderDamageDeck.removeAll();
        document.querySelector('.ss-damage-reorder-dialog__title').innerHTML = options.title;
        this.setVisibleEl(dialogEl, true);

        for (let card of Object.values(cards)) {
          this.reorderDamageDeck.addToStockWithId(card.type, card.id);
        }

        this.reorderDamageDeck.setSelectionMode(2);
        this.addActionButton('buttonReset', _('Restart selection'), () => {
          selectedCards.forEach(card => {
            this.reorderDamageDeck.addToStockWithId(card.type, card.id);
          });
          selectedCards = [];
        });
        this.addActionButton('buttonAccept', _('Accept'), () => {
          if (selectedCards.length !== options.count) {
            gameui.showMessage(dojo.string.substitute(_('You must select ${num} cards'), {
              num: options.count
            }), 'error');
            return;
          }
          cleanAll();
          resolve(selectedCards);
        });
        this.reorderDamageDeck.setSelectionMode(1);
        handles.push(this.connectStockCardClick(this.reorderDamageDeck, card => {
          if (card.type === 'hull' && selectedCards.length < options.count - 1) {
            gameui.showMessage(_('Hull breach must be the last damage card'), 'error');
            return;
          }
          selectedCards.push(card);
          this.reorderDamageDeck.removeFromStockById(card.id);
        }));
      });
    },

    waitForResourceType(options = {}) {
      // Default options
      options = Object.assign({
        cancel: false
      }, options);

      const cleanAll = () => {
        this.removeActionButtons();
      };

      return new Promise((resolve, reject) => {
        this.resourceTypes.filter(r => r.id !== 'universal').forEach(resourceType => {
          this.addActionButton("buttonResourceType__" + resourceType.id, "<span class=\"ss-resource-card-icon ss-resource-card-icon--medium ss-resource-card-icon--" + resourceType.id + "\"></span>" + resourceType.name, () => {
            cleanAll();
            resolve(resourceType);
          });
        });

        if (options.cancel) {
          this.showActionCancelButton(() => {
            cleanAll();
            reject('CANCEL_BTN');
          });
        }
      });
    },

    updateResourceCardsNbr(num) {
      document.querySelector('.ss-resource-deck__deck__number').innerHTML = num;
    },

    addTooltipMarkdown(el, text, args = {}, delay = 250) {
      const id = this.getElId(el);
      const content = '<div class="ss-tooltip-markdown">' + markdownSubstitute(text, args) + '</div>';
      this.addTooltipHtml(id, content, delay);
    },

    getElId: (() => {
      let idCounter = 0;
      return el => {
        if (el.id) {
          return el.id;
        }

        idCounter++;
        const id = 'el-' + idCounter;
        el.id = id;
        return id;
      };
    })(),

    showDiceResult(result, message = null) {
      if (this.prefs[100].value == 2) return;
      const diceEl = document.querySelector('.ss-dice-result-dialog__dice');
      diceEl.setAttribute('data-face', result);
      const diceMessageEl = document.querySelector('.ss-dice-result-dialog__message');
      diceMessageEl.innerHTML = message || '';
      const dialogEl = document.querySelector('.ss-dice-result-dialog');
      this.setVisibleEl(dialogEl, true);

      if (this.diceResultDialogTimeout) {
        clearTimeout(this.diceResultDialogTimeout);
      }

      this.diceResultDialogTimeout = setTimeout(() => {
        this.setVisibleEl(dialogEl, false);
      }, 5000);
    },

    ///////////////////////////////////////////////////
    //// Player's action
    ajaxAction(action, args, check = true) {
      console.log('ajaxAction', action, args, check);

      if (check & !this.checkAction(action)) {
        return;
      }

      return new Promise((resolve, reject) => {
        this.ajaxcall("/solarstorm/solarstorm/" + action + ".html", args, this, function (result) {
          resolve(result);
        }, function (is_error) {
          reject(is_error);
        });
      });
    },

    onPlayerChooseAction(evt, action) {
      dojo.stopEvent(evt);
      this.ajaxAction('choose', {
        lock: true,
        actionName: action
      });
    },

    async doPlayerActionMove(possibleDestinations) {
      try {
        const rooms = possibleDestinations.map(p => this.rooms.getByPosition(p));
        const room = await this.waitForRoomClick(rooms, {
          cancel: true
        });
        await this.ajaxAction('move', {
          lock: true,
          position: room.position
        });
      } catch (e) {
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerActionDiscardResource(numCardsToDiscard, reason = null) {
      let message = _('You must discard ${num} cards(s)');

      this.gamedatas.gamestate.descriptionmyturn = dojo.string.substitute(message, {
        num: numCardsToDiscard
      });
      this.updatePageTitle();
      const cards = await this.waitForPlayerResources({
        count: numCardsToDiscard,
        cancel: false,
        btnText: _('Discard selected')
      });
      await this.ajaxAction('discardResources', {
        lock: true,
        cardIds: cards.map(c => c.id).join(',')
      });
    },

    async doPlayerActionGiveResource(sameRoomOnly = true) {
      this.gamedatas.gamestate.descriptionmyturn = _('You must choose a card to give');
      this.updatePageTitle();
      this.removeActionButtons();

      try {
        const activePlayer = this.players.getActive();
        const card = await this.waitForPlayerResource([activePlayer], {
          cancel: true
        });
        this.gamedatas.gamestate.descriptionmyturn = _('You must choose a player to give the card to');
        this.updatePageTitle();
        this.removeActionButtons();
        const targetPlayers = this.players.getInactive().filter(p => !sameRoomOnly || p.position === activePlayer.position);
        const player = await this.waitForPlayerSelection(targetPlayers, {
          cancel: true
        });
        await this.ajaxAction('giveResourceToAnotherPlayer', {
          lock: true,
          cardId: card.id,
          playerId: player.id
        });
      } catch (e) {
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerActionTakeResource(sameRoomOnly = true) {
      this.gamedatas.gamestate.descriptionmyturn = _('You must choose a card to take');
      this.updatePageTitle();
      this.removeActionButtons();

      try {
        const activePlayer = this.players.getActive();
        const targetPlayers = this.players.getInactive().filter(p => !sameRoomOnly || p.position === activePlayer.position);
        const card = await this.waitForPlayerResource(targetPlayers, {
          cancel: true
        });
        await this.ajaxAction('pickResourceFromAnotherPlayer', {
          lock: true,
          cardId: card.id
        });
      } catch (e) {
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerActionSwapResource() {
      this.gamedatas.gamestate.descriptionmyturn = _('Swap cards : You must choose a card to give');
      this.updatePageTitle();
      this.removeActionButtons();

      try {
        const card1 = await this.waitForPlayerResource([this.players.getActive()], {
          cancel: true
        });
        this.gamedatas.gamestate.descriptionmyturn = _('Swap cards : You must choose a card to exchange');
        this.updatePageTitle();
        this.removeActionButtons();
        const card2 = await this.waitForPlayerResource(this.players.getInactive(), {
          cancel: true
        });
        await this.ajaxAction('swapResourceWithAnotherPlayer', {
          lock: true,
          cardId: card1.id,
          card2Id: card2.id
        });
      } catch (e) {
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerActionRepair(possibleRepairs) {
      try {
        const resourceTypes = possibleRepairs ? possibleRepairs.map(r => r.card.type) : null;
        const card = await this.waitForPlayerResource([this.players.getActive()], {
          cancel: true,
          resourceTypes
        });
        let resourceTypeId = null;

        if (card.type === 'universal') {
          resourceTypeId = (await this.waitForResourceType({
            cancel: true
          })).id;
        }

        await this.ajaxAction('selectResourceForRepair', {
          lock: true,
          cardId: card.id,
          resourceType: resourceTypeId
        });
      } catch (e) {
        console.error(e);
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerActionDivert() {
      try {
        const cards = await this.waitForPlayerResources({
          count: 3,
          cancel: true,
          btnText: _('Use selected cards')
        });
        await this.ajaxAction('selectResourcesForDivert', {
          lock: true,
          cardIds: cards.map(c => c.id).join(',')
        });
      } catch (e) {
        console.error(e);
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerRoomCargoHold(cards) {
      const selectedCards = await this.waitForResourceCardOrderFromDialog(cards, {
        title: _('Reorder the next resource cards.') + '<br/>' + _('The first ones you select will be on <b>top</b> of the deck.'),
        cancel: false
      });
      await this.ajaxAction('putBackResourceCardsInDeck', {
        lock: true,
        cardIds: selectedCards.map(c => c.id).join(',')
      });
    },

    async doPlayerRoomBridge(cards) {
      const selectedCards = await this.waitForDamageCardOrderFromDialog(cards, {
        title: _('Reorder the next damage cards.') + '<br/>' + _('The first ones you select will be on <b>top</b> of the deck.'),
        cancel: false
      });
      await this.ajaxAction('putBackDamageCardsInDeck', {
        lock: true,
        cardIds: selectedCards.map(c => c.id).join(',')
      });
    },

    async doPlayerRoomCrewQuarter() {
      try {
        const player = await this.waitForPlayerMeepleClick(this.players.players, {
          cancel: true
        });
        this.gamedatas.gamestate.descriptionmyturn = _('Crew Quarters: You must choose a destination');
        this.updatePageTitle();
        this.removeActionButtons(); // Valid rooms are where there are meeples

        const validRooms = this.players.players.map(p => p.position).map(p => this.rooms.getByPosition(p));
        const room = await this.waitForRoomClick(validRooms, {
          cancel: true
        });
        await this.ajaxAction('moveMeepleToRoom', {
          lock: true,
          playerId: player.id,
          position: room.position
        });
      } catch (e) {
        if (e !== 'CANCEL_BTN') {
          console.error(e);
          this.showMessage(e.message, 'error');
        }

        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerRoomEngineRoom(cards) {
      try {
        const card = await this.waitForResourceCardFromDialog(cards, {
          title: _('Select a card from the discard, to be swapped with one from your hand'),
          cancel: true
        });
        const card2 = await this.waitForPlayerResource([this.players.getActive()], {
          cancel: true
        });
        await this.ajaxAction('swapResourceFromDiscard', {
          lock: true,
          cardId: card.id,
          card2Id: card2.id
        });
      } catch (e) {
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerRoomRepairCentre() {
      try {
        const room = await this.waitForRoomClick(this.rooms.rooms, {
          cancel: true
        });
        this.gamedatas.gamestate.descriptionmyturn = dojo.string.substitute(_('Repair Centre: You must choose a resource to repair: ${room}'), {
          room: _(room.name)
        });
        this.updatePageTitle();
        this.removeActionButtons();
        const card = await this.waitForPlayerResource([this.players.getActive()], {
          cancel: true
        });
        let resourceTypeId = null;

        if (card.type === 'universal') {
          resourceTypeId = (await this.waitForResourceType({
            cancel: true
          })).id;
        }

        await this.ajaxAction('selectResourceForRepair', {
          lock: true,
          cardId: card.id,
          position: room.position,
          resourceType: resourceTypeId
        });
      } catch (e) {
        console.error(e);
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerRoomArmoury(tokensToPut) {
      const onCancel = [];

      try {
        const validRooms = this.rooms.rooms.filter(r => r.slug !== 'energy-core');
        const positions = [];

        for (let i = 0; i < tokensToPut; i++) {
          const room = await this.waitForRoomClick(validRooms, {
            cancel: true
          });
          positions.push(room.position);
          room.protection.push(this.players.getActive().id);
          room.updateProtectionTokens();
          onCancel.push(() => {
            room.protection.pop();
            room.updateProtectionTokens();
          });
        }

        await this.ajaxAction('putProtectionTokens', {
          lock: true,
          positions: positions.join(',')
        });
      } catch (e) {
        console.error(e);
        onCancel.forEach(f => f());
        await this.ajaxAction('cancel', {
          lock: true
        });
      }
    },

    async doPlayerPickResources(possibleSources, canRestartTurn) {
      try {
        const card = await this.waitForResourceFromDeck({
          cancel: false,
          restart: canRestartTurn,
          deck: possibleSources.includes('deck'),
          table: possibleSources.includes('table')
        });
        await this.ajaxAction('pickResource', {
          lock: true,
          cardId: card.id
        });
      } catch (e) {
        if (e === 'RESTART_BTN') {
          await this.ajaxAction('restartTurn', {
            lock: true
          });
        } else {
          console.error(e);
        }
      }
    },

    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications

    /*
              setupNotifications:
               In this method, you associate each of your game notifications with your local method to handle it.
               Note: game notification names correspond to "notifyAllPlayers" and "notifyPlayer" calls in
                    your solarstorm.game.php file.
           */
    setupNotifications: function () {
      dojo.subscribe('updateRooms', this, 'notif_updateRooms');
      dojo.subscribe('updateDamageDiscard', this, 'notif_updateDamageDiscard');
      dojo.subscribe('addResourcesCardsOnTable', this, 'notif_addResourcesCardsOnTable');
      dojo.subscribe('updatePlayerData', this, 'notif_updatePlayerData');
      dojo.subscribe('playerPickResource', this, 'notif_playerPickResource');
      dojo.subscribe('playerDiscardResource', this, 'notif_playerDiscardResource');
      dojo.subscribe('playerShareResource', this, 'notif_playerShareResource');
      dojo.subscribe('putBackResourcesCardInDeck', this, 'notif_putBackResourcesCardInDeck');
      dojo.subscribe('playerRollsDice', this, 'notif_playerRollsDice');
      dojo.subscribe('hullBreachDiscard', this, 'notif_hullBreachDiscard');
      dojo.subscribe('fullState', this, 'notif_fullState');
      dojo.subscribe('endOfGame', this, 'notif_endOfGame');
    },

    notif_updateRooms(notif) {
      console.log('notif_updateRooms', notif);
      notif.args.rooms.forEach(roomData => {
        const room = this.rooms.getBySlug(roomData.slug);
        room.setDamage(roomData.damage);
        room.setDiverted(roomData.diverted);
        room.setDestroyed(roomData.destroyed);
        room.setProtection(roomData.protection);

        if (roomData.shake) {
          room.shake();
        }
      });
    },

    notif_updateDamageDiscard(notif) {
      console.log('notif_updateDamageDiscard', notif);
      notif.args.cards.forEach(cardData => {
        this.damageDeck.addToStock(cardData.type);
      });
      this.updateDamageCardsLeft(notif.args.damageCardsNbr);
    },

    notif_addResourcesCardsOnTable(notif) {
      console.log('notif_addResourcesCardsOnTable', notif);
      notif.args.cards.forEach(cardData => {
        this.resourceDeck.addToStockWithId(cardData.type, cardData.id);
      });
      this.updateResourceCardsNbr(notif.args.resourceCardsNbr);
    },

    notif_playerPickResource(notif) {
      console.log('notif_playerPickResource', notif);
      const card = notif.args.card;
      this.resourceDeck.removeFromStockById(card.id);
      const player = this.players.getPlayerById(notif.args.player_id);
      player.stock.addToStockWithId(card.type, card.id);

      if (notif.args.resourceCardsNbr) {
        this.updateResourceCardsNbr(notif.args.resourceCardsNbr);
      } // TODO animation

    },

    notif_playerDiscardResource(notif) {
      console.log('notif_playerDiscardResource', notif);
      const cards = notif.args.cards ? notif.args.cards : [notif.args.card];
      const player = this.players.getPlayerById(notif.args.player_id);
      cards.forEach(card => player.stock.removeFromStockById(card.id)); // TODO animation
    },

    notif_playerShareResource(notif) {
      console.log('notif_playerShareResource', notif);
      const card = notif.args.card;
      const player = this.players.getPlayerById(notif.args.player_id);

      if (notif.args.shareAction === 'take') {
        const fromPlayer = this.players.getPlayerById(notif.args.from_player_id);
        fromPlayer.stock.removeFromStockById(card.id);
        player.stock.addToStockWithId(card.type, card.id);
      } else {
        const toPlayer = this.players.getPlayerById(notif.args.to_player_id);
        player.stock.removeFromStockById(card.id);
        toPlayer.stock.addToStockWithId(card.type, card.id);
      } // TODO animation

    },

    notif_putBackResourcesCardInDeck(notif) {
      console.log('notif_putBackResourcesCardInDeck', notif);
      const card = notif.args.card;
      this.reorderResourceDeck.removeFromStockById(card.id, document.querySelector('.ss-resource-deck__deck'));
    },

    notif_updatePlayerData(notif) {
      console.log('notif_updatePlayerData', notif);
      const player = this.players.getPlayerById(notif.args.player_id);
      player.setRoomPosition(notif.args.position);
      player.setActionsTokens(notif.args.actionsTokens);

      if (notif.args.resourceCards) {
        player.stock.removeAll();
        notif.args.resourceCards.forEach(resourceCard => {
          player.stock.addToStockWithId(resourceCard.type, resourceCard.id);
        });
      }
    },

    notif_playerRollsDice(notif) {
      console.log('notif_playerRollsDice', notif);
      const message = this.format_string_recursive(notif.log, notif.args);
      this.showDiceResult(notif.args.dieResult, message);
    },

    notif_hullBreachDiscard(notif) {
      console.log('notif_hullBreachDiscard', notif);
      const message = this.format_string_recursive(notif.log, notif.args);
      this.showDiceResult(notif.args.dieResult, message);

      if (notif.args.resourceCardsNbr) {
        this.updateResourceCardsNbr(notif.args.resourceCardsNbr);
      }
    },

    notif_fullState(notif) {
      console.log('notif_fullState', notif);
      notif.args.players.forEach(playerData => {
        const player = this.players.getPlayerById(playerData.id);
        player.setRoomPosition(playerData.position);
        player.setActionsTokens(playerData.actionsTokens);
        player.stock.removeAll();
        playerData.resourceCards.forEach(resourceCard => {
          player.stock.addToStockWithId(resourceCard.type, resourceCard.id);
        });
      });
      notif.args.rooms.forEach(roomData => {
        const room = this.rooms.getBySlug(roomData.slug);
        room.setDamage(roomData.damage);
        room.setDiverted(roomData.diverted);
        room.setDestroyed(roomData.destroyed);
        room.setProtection(roomData.protection);
      });
    },

    notif_endOfGame(notif) {
      console.log('notif_endOfGame', notif);
      const value = notif.args.victory ? 1 : 0;
      this.players.players.forEach(player => {
        this.scoreCtrl[player.id].setValue(value);
      });
    },

    /* This enable to inject translatable styled things to logs or action bar */

    /* @Override */
    format_string_recursive: function (log, args) {
      try {
        if (log && args && !args.processed) {
          args.processed = true; // Representation of a resource card type

          if (args.resourceType !== undefined) {
            const type = this.resourceTypes.find(r => r.id === args.resourceType);
            args.resourceType = dojo.string.substitute('<span class="ss-resource-card-icon ss-resource-card-icon--small ss-resource-card-icon--${resourceType}"></span>${resourceName}', {
              resourceType: type.id,
              resourceName: _(type.nametr)
            });
          } // Representation of a resource card type (2)


          if (args.resourceType2 !== undefined) {
            const type = this.resourceTypes.find(r => r.id === args.resourceType2);
            args.resourceType2 = dojo.string.substitute('<span class="ss-resource-card-icon ss-resource-card-icon--small ss-resource-card-icon--${resourceType2}"></span>${resourceName}', {
              resourceType2: type.id,
              resourceName: _(type.nametr)
            });
          } // Representation of a many resource card types


          if (args.resourceTypes !== undefined) {
            const str = args.resourceTypes.map(resourceType => {
              const type = this.resourceTypes.find(r => r.id === resourceType);
              return dojo.string.substitute('<span class="ss-resource-card-icon ss-resource-card-icon--small ss-resource-card-icon--${resourceType}"></span>${resourceName}', {
                resourceType: type.id,
                resourceName: _(type.nametr)
              });
            });
            args.resourceTypes = str.join(', ');
          } // Representation of a room name


          if (args.roomName !== undefined) {
            const room = this.rooms.getBySlug(args.roomName);
            args.roomName = dojo.string.substitute('<span class="ss-room-name" data-room="${roomSlug}" style="color: ${roomColor}">${roomName}</span>', {
              roomName: _(room.name),
              roomColor: room.color,
              roomSlug: room.slug
            });
          } // Representation of room names


          for (let index = 0; index < 5; index++) {
            const argName = 'roomNames' + (index > 0 ? index + 1 : '');

            if (args[argName] !== undefined) {
              const str = args[argName].map(roomName => {
                const room = this.rooms.getBySlug(roomName);
                return dojo.string.substitute('<span class="ss-room-name" data-room="${roomSlug}" style="color: ${roomColor}">${roomName}</span>', {
                  roomName: _(room.name),
                  roomColor: room.color,
                  roomSlug: room.slug
                });
              });
              args[argName] = str.join(', ');
            }
          } // Representation of a die result


          if (args.die_result !== undefined) {
            args.die_result = dojo.string.substitute('<span class="ss-dice ss-dice--small" data-face="${die_result}"></span>', {
              die_result: args.die_result
            });
          }
        }
      } catch (e) {
        console.error(log, args, 'Exception thrown', e.stack);
      }

      return this.inherited(arguments);
    }
  });
});

class SSRooms {
  constructor() {
    _defineProperty(this, "rooms", []);
  }

  addRoom(room) {
    this.rooms.push(room);
  }

  getByEl(el) {
    return this.rooms.find(r => r.el === el);
  }

  getBySlug(slug) {
    return this.rooms.find(r => r.slug === slug);
  }

  getByPosition(position) {
    return this.rooms.find(r => r.position === position);
  }

  highlightPositions(positions) {
    this.rooms.forEach(room => {
      room.highlight(positions && positions.includes(room.position));
    });
  }

  removeAll() {
    // TODO clear events & co
    this.rooms = [];
  }

}

class SSRoom {
  constructor(gameObject, data) {
    _defineProperty(this, "gameObject", null);

    _defineProperty(this, "id", null);

    _defineProperty(this, "slug", null);

    _defineProperty(this, "name", null);

    _defineProperty(this, "color", null);

    _defineProperty(this, "description", null);

    _defineProperty(this, "position", null);

    _defineProperty(this, "damage", [false, false, false]);

    _defineProperty(this, "diverted", false);

    _defineProperty(this, "destroyed", false);

    _defineProperty(this, "protection", []);

    _defineProperty(this, "el", null);

    _defineProperty(this, "divertedTokenEl", null);

    _defineProperty(this, "shakeTimeout", null);

    this.gameObject = gameObject;
    this.id = data.id;
    this.slug = data.slug;
    this.name = data.name;
    this.color = data.color;
    this.description = data.description;
    this.position = data.position;
    this.assertEl();
    this.setDamage(data.damage);
    this.setDiverted(data.diverted);
    this.setDestroyed(data.destroyed);
    this.setProtection(data.protection);
  }

  assertEl() {
    let el = document.querySelector(".ss-room-card--" + this.id);

    if (el) {
      this.el = el;
      return;
    }

    const roomsEl = document.querySelector('.ss-rooms');
    el = dojo.create('div', {
      id: "ss-room--" + this.id,
      class: "ss-room ss-room--pos-" + this.position + " ss-room-card--" + this.id + " ss-room--" + this.id
    }, roomsEl);
    const fullText = [];
    fullText.push("<span class=\"ss-room-name\" data-room=\"" + this.slug + "\" style=\"color: " + this.color + "\">" + _(this.name) + "</span>\n-----\n");

    if (this.slug !== 'energy-core') {
      // prettier-ignore
      const divertText = _('**Resources needed to divert power**${newline}This takes 1 action.${newline}You must discard **all** the required Resource cards.${newline}Note: a diverted room can be fully repaired, in 1 action, with only 1 resource card !'); // prettier-ignore


      const repairText = _('**Resources needed to repair the room.**${newline}This takes 1 action by repair slot.${newline}You must discard the required Resource card.');

      fullText.push(("<div class=\"ss-room-tooltip\">\n\t\t\t\t\t<div>\n\t\t\t\t\t\t<div class=\"ss-room--zoom-divert ss-room--" + this.id + "\"></div>\n\t\t\t\t\t\t<div>\u2B07</div>\n\t\t\t\t\t\t<div class=\"ss-diverted-token\"></div>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div>" + divertText + "</div>\n\t\t\t\t\t<div>" + repairText + "</div>\n\t\t\t\t\t<div>\n\t\t\t\t\t\t<div class=\"ss-room--zoom-repair ss-room--" + this.id + "\"></div>\n\t\t\t\t\t\t<div>\u2B06</div>\n\t\t\t\t\t\t<div class=\"ss-damage-cube\"></div>\n\t\t\t\t\t</div>\n\t\t\t\t</div>").replace(/\n\i*/g, '') + '\n----\n');
      fullText.push(_('**Room action** (when the room is not damaged) :') + '\n');
    }

    fullText.push(_(this.description));
    this.gameObject.addTooltipMarkdown(el, fullText.join(''), {}, 1000);

    if (this.id !== 0) {
      for (let i = 0; i < 3; i++) {
        dojo.create('div', {
          class: "ss-room__damage ss-room__damage--" + i
        }, el);
      }

      this.divertedTokenEl = dojo.create('div', {
        class: 'ss-room__diverted-token'
      }, el);
    }

    this.el = el;
  }

  setDamage(damage) {
    if (this.id === 0) {
      return;
    }

    damage.forEach((dmg, index) => {
      this.el.classList.toggle("ss-room--damaged-" + index, dmg);
    });
    this.damage = damage;
  }

  setDiverted(diverted) {
    if (this.id === 0) {
      return;
    }

    this.diverted = diverted;
    this.gameObject.setVisibleEl(this.divertedTokenEl, diverted);
  }

  setProtection(protection) {
    if (this.id === 0) {
      return;
    }

    if (!Array.isArray(protection)) {
      protection = [];
    } // Assert numbers, and sort


    protection = protection.map(p => +p).sort();
    const doUpdate = protection.toString() !== this.protection.toString();
    this.protection = protection;

    if (doUpdate) {
      this.updateProtectionTokens();
    }
  }

  updateProtectionTokens() {
    // Remove all
    dojo.query('.ss-protection-token', this.el).forEach(el => {
      el.remove();
      this.gameObject.removeTooltip(el.id);
    }); // Add them

    let index = 0;
    this.protection.forEach(playerId => {
      const id = "ss-protection-token--" + this.position + "-" + index;
      const player = this.gameObject.players.getPlayerById(playerId);

      if (!player) {
        return;
      }

      const order = player.order;
      dojo.create('div', {
        class: "ss-protection-token ss-protection-token--" + order,
        id
      }, this.el); // prettier-ignore

      const tooltip = dojo.string.substitute(_("Protection token put by ${player_name}.${newline}It will be removed when a damage is received on this room, or at the <b>start</b> of ${player_name}'s turn"), {
        player_name: player.name,
        newline: '<br/>'
      });
      this.gameObject.addTooltipHtml(id, tooltip, 250);
      index++;
    });
  }

  highlight(value) {
    this.gameObject.highlightEl(this.el, value);
  }

  highlightHover(value) {
    this.gameObject.highlightEl(this.el, value, 'ss-highlight-hover');
  }

  shake() {
    if (this.shakeTimeout) {
      clearTimeout(this.shakeTimeout);
    }

    this.el.classList.add('ss-shake');
    this.shakeTimeout = setTimeout(() => {
      this.el.classList.remove('ss-shake');
    }, 2000);
  }

  setDestroyed(destroyed) {
    this.destroyed = destroyed;
    this.el.classList.toggle('ss-room-destroyed', destroyed);
  }

}

class SSPlayers {
  constructor(gameObject) {
    _defineProperty(this, "gameObject", null);

    _defineProperty(this, "players", []);

    this.gameObject = gameObject;
  }

  addPlayer(player) {
    this.players.push(player);
  }

  getPlayerById(id) {
    return this.players.find(p => p.id === +id);
  } // Return active player


  getActive() {
    return this.getPlayerById(+this.gameObject.getActivePlayerId());
  } // Return inactive players (array)


  getInactive() {
    return this.players.filter(p => p.id !== +this.gameObject.getActivePlayerId());
  }

  getAtPosition(position) {
    return this.players.filter(p => p.position === +position);
  }

  assertPositions() {
    this.players.forEach(player => {
      player.setRoomPosition(player.position, true, false);
    });
  }

  highlightActive() {
    this.players.forEach(player => {
      player.highlightActive();
    });
  }

  highlightHands(ids, resourceTypes = null) {
    this.players.forEach(player => {
      player.highlightHand(ids && ids.includes(player.id), resourceTypes);
    });
  }

  highlightBoards(ids) {
    this.players.forEach(player => {
      player.highlightBoard(ids && ids.includes(player.id));
    });
  }

  highlightMeeples(ids) {
    this.players.forEach(player => {
      player.highlightMeeple(ids === 'all' || ids && ids.includes(player.id));
    });
  }

  removeAll() {
    // TODO clear events & co
    this.players = [];
  }

}

class SSPlayer {
  constructor(gameObject, id, name, color, order, position, actionsTokens, overlapPref) {
    _defineProperty(this, "gameObject", null);

    _defineProperty(this, "id", null);

    _defineProperty(this, "name", null);

    _defineProperty(this, "color", null);

    _defineProperty(this, "stock", null);

    _defineProperty(this, "order", null);

    _defineProperty(this, "position", null);

    _defineProperty(this, "actionsTokens", 0);

    _defineProperty(this, "boardEl", null);

    _defineProperty(this, "nameEl", null);

    _defineProperty(this, "handEl", null);

    _defineProperty(this, "handDeckEl", null);

    _defineProperty(this, "meepleEl", null);

    _defineProperty(this, "actionsTokensEl", null);

    _defineProperty(this, "actionsTokensNumberEl", null);

    this.gameObject = gameObject;
    this.id = +id;
    this.name = name;
    this.color = color;
    this.order = order;
    this.overlapPref = overlapPref;
    this.assertBoardEl();
    this.assertMeepleEl();
    this.createStock();
    this.setRoomPosition(position, false, true);
    this.setActionsTokens(actionsTokens);
  }

  isCurrent() {
    return this.gameObject.player_id == this.id;
  }

  isCurrentActive() {
    return this.gameObject.player_id == this.id && this.gameObject.getActivePlayerId() == this.id;
  }

  assertBoardEl() {
    let boardEl = document.querySelector(".ss-players-board--id-" + this.id);

    if (boardEl) {
      this.boardEl = boardEl;
      return;
    }

    const playersHandsEl = document.querySelector('.ss-players-hands');
    boardEl = dojo.create('div', {
      class: "ss-player-board ss-players-board--id-" + this.id
    }, playersHandsEl);
    this.boardEl = boardEl;
    const handName = this.isCurrent() ? _('Your hand') : _('Hand of') + (" " + this.name);
    this.nameEl = dojo.create('div', {
      class: 'ss-player-board__name ss-section-title',
      innerHTML: "<span><span class=\"ss-player-meeple-icon ss-player-meeple-icon--order-" + this.order + "\"></span>" + handName + "</span>"
    }, boardEl);
    this.handEl = dojo.create('div', {
      class: 'ss-player-hand',
      style: {
        backgroundColor: "#" + this.color + "55",
        boxShadow: "#" + this.color + "55 0px 0px 4px 2px"
      }
    }, this.boardEl);
    this.handDeckEl = dojo.create('div', {
      class: 'ss-player-hand__deck',
      id: "ss-player-hand--" + this.id
    }, this.handEl);
    this.actionsTokensEl = dojo.create('div', {
      class: 'ss-player-board__action-tokens'
    }, boardEl);
    dojo.create('div', {
      class: 'ss-player-board__action-tokens__token ss-action-token'
    }, this.actionsTokensEl);
    this.actionsTokensNumberEl = dojo.create('div', {
      class: 'ss-player-board__action-tokens__number'
    }, this.actionsTokensEl); // prettier-ignore

    this.gameObject.addTooltipMarkdown(this.actionsTokensEl, [_('Actions Tokens.${newline}At any time during their turn, this player can use one action token to gain one action.${newline}They can also use an action to gain a action token for later.'), '\n----\n', _('**Note** : there are only **8** action tokens available for all players.')].join(''), {}, 250);
  } // Assert meeple element (create it if necessary)


  assertMeepleEl() {
    let meepleEl = document.querySelector(".ss-player-meeple--id-" + this.id);

    if (meepleEl) {
      this.meepleEl = meepleEl;
      return;
    }

    const roomsWrapperEl = document.querySelector('.ss-rooms-wrapper');
    meepleEl = dojo.create('div', {
      id: "ss-player-meeple--id-" + this.id,
      class: "ss-player-meeple ss-player-meeple--order-" + this.order + " ss-player-meeple--id-" + this.id
    }, roomsWrapperEl);
    this.gameObject.addTooltipHtml(meepleEl.id, '<span style="font-weight: bold; color:#' + this.color + '">' + this.name + '</span>', 250);
    this.meepleEl = meepleEl;
  }

  createStock() {
    this.stock = new ebg.stock();
    this.stock = this.gameObject.createResourceStock(this.handDeckEl);
    this.stock.setSelectionMode(0);
    if (this.overlapPref == 1) this.stock.setOverlap(30, 0);
    this.gameObject.resourceTypes.forEach((type, index) => {
      this.stock.addItemType(type.id, index, g_gamethemeurl + 'img/resources.jpg', index);
    });
  }

  setRoomPosition(position, instant = false, moveOthers = true) {
    const previousPosition = this.position;
    this.position = position;

    if (position === null) {
      // this.meepleEl.style.display = 'none'
      return;
    }

    this.meepleEl.style.display = 'block';
    const roomEl = this.gameObject.rooms.getByPosition(position).el;
    const duration = instant ? 0 : 750;
    const roomPos = dojo.position(roomEl);
    const index = this.order;
    const offsetX = index * 30 + 20;
    const offsetY = roomPos.h * 0.2;
    this.gameObject.slideToObjectPos(this.meepleEl, roomEl, offsetX, offsetY, duration, 0).play();

    if (moveOthers) {
      this.gameObject.players.getAtPosition(position).forEach(p => p.setRoomPosition(position, false, false));

      if (previousPosition !== position) {
        this.gameObject.players.getAtPosition(previousPosition).forEach(p => p.setRoomPosition(previousPosition || 0, false, false));
      }
    }
  }

  highlightHand(value, resourceTypes) {
    this.gameObject.highlightEl(this.handEl, value);
    dojo.query('.ss-resource-card--disable', this.handEl).removeClass('ss-resource-card--disable');

    if (value && resourceTypes) {
      dojo.query('.ss-resource-card', this.handEl).forEach(el => {
        var id = el.id.match(/^ss-player-hand--\d+_item_(\d+)$/)[1];
        const type = el.getAttribute('data-type');
        var possible = resourceTypes.includes(type);

        if (!possible) {
          el.classList.add('ss-resource-card--disable');
        }
      });
    }
  }

  highlightBoard(value) {
    this.gameObject.highlightEl(this.boardEl, value);
  }

  highlightMeeple(value) {
    this.gameObject.highlightEl(this.meepleEl, value);
  }

  highlightActive() {
    const isActive = this.gameObject.getActivePlayerId() == this.id;
    this.gameObject.highlightEl(this.meepleEl, isActive, 'ss-player-meeple--active');
    const smallMeepleEl = this.nameEl.querySelector('.ss-player-meeple-icon');
    this.gameObject.highlightEl(smallMeepleEl, isActive, 'ss-player-meeple-icon--active');
  }

  setActionsTokens(value) {
    this.actionsTokens = value;
    this.actionsTokensNumberEl.innerHTML = '×' + value;
    this.gameObject.setVisibleEl(this.actionsTokensEl, value > 0);
  }

}

const markdownSubstitute = (() => {
  // https://github.com/Chalarangelo/parse-md-js

  /***   Regex Markdown Parser by chalarangelo   ***/
  // Replaces 'regex' with 'replacement' in 'str'
  // Curry function, usage: replaceRegex(regexVar, replacementVar) (strVar)
  const replaceRegex = function (regex, replacement) {
    return function (str) {
      return str.replace(regex, replacement);
    };
  }; // Regular expressions for Markdown (a bit strict, but they work)


  const codeBlockRegex = /((\n\t)(.*))+/g;
  const inlineCodeRegex = /(`)(.*?)\1/g;
  const imageRegex = /!\[([^\[]+)\]\(([^\)]+)\)/g;
  const linkRegex = /\[([^\[]+)\]\(([^\)]+)\)/g;
  const headingRegex = /\n(#+\s*)(.*)/g;
  const boldItalicsRegex = /(\*{1,2})(.*?)\1/g;
  const strikethroughRegex = /(\~\~)(.*?)\1/g;
  const blockquoteRegex = /\n(&gt;|\>)(.*)/g;
  const horizontalRuleRegex = /\n((\-{3,})|(={3,}))/g;
  const unorderedListRegex = /(\n\s*(\-|\+)\s.*)+/g;
  const orderedListRegex = /(\n\s*([0-9]+\.)\s.*)+/g;
  const paragraphRegex = /\n+(?!<pre>)(?!<h)(?!<ul>)(?!<blockquote)(?!<hr)(?!\t)([^\n]+)\n/g; // Replacer functions for Markdown

  const codeBlockReplacer = function (fullMatch) {
    return '\n<pre>' + fullMatch + '</pre>';
  };

  const inlineCodeReplacer = function (fullMatch, tagStart, tagContents) {
    return '<code>' + tagContents + '</code>';
  };

  const imageReplacer = function (fullMatch, tagTitle, tagURL) {
    return '<img src="' + tagURL + '" alt="' + tagTitle + '" />';
  };

  const linkReplacer = function (fullMatch, tagTitle, tagURL) {
    return '<a href="' + tagURL + '">' + tagTitle + '</a>';
  };

  const headingReplacer = function (fullMatch, tagStart, tagContents) {
    return '\n<h' + tagStart.trim().length + '>' + tagContents + '</h' + tagStart.trim().length + '>';
  };

  const boldItalicsReplacer = function (fullMatch, tagStart, tagContents) {
    return '<' + (tagStart.trim().length == 1 ? 'em' : 'strong') + '>' + tagContents + '</' + (tagStart.trim().length == 1 ? 'em' : 'strong') + '>';
  };

  const strikethroughReplacer = function (fullMatch, tagStart, tagContents) {
    return '<del>' + tagContents + '</del>';
  };

  const blockquoteReplacer = function (fullMatch, tagStart, tagContents) {
    return '\n<blockquote>' + tagContents + '</blockquote>';
  };

  const horizontalRuleReplacer = function (fullMatch) {
    return '\n<hr />';
  };

  const unorderedListReplacer = function (fullMatch) {
    let items = '';
    fullMatch.trim().split('\n').forEach(item => {
      items += '<li>' + item.substring(2) + '</li>';
    });
    return '\n<ul>' + items + '</ul>';
  };

  const orderedListReplacer = function (fullMatch) {
    let items = '';
    fullMatch.trim().split('\n').forEach(item => {
      items += '<li>' + item.substring(item.indexOf('.') + 2) + '</li>';
    });
    return '\n<ol>' + items + '</ol>';
  };

  const paragraphReplacer = function (fullMatch, tagContents) {
    return '<p>' + tagContents + '</p>';
  }; // Rules for Markdown parsing (use in order of appearance for best results)


  const replaceCodeBlocks = replaceRegex(codeBlockRegex, codeBlockReplacer);
  const replaceInlineCodes = replaceRegex(inlineCodeRegex, inlineCodeReplacer);
  const replaceImages = replaceRegex(imageRegex, imageReplacer);
  const replaceLinks = replaceRegex(linkRegex, linkReplacer);
  const replaceHeadings = replaceRegex(headingRegex, headingReplacer);
  const replaceBoldItalics = replaceRegex(boldItalicsRegex, boldItalicsReplacer);
  const replaceceStrikethrough = replaceRegex(strikethroughRegex, strikethroughReplacer);
  const replaceBlockquotes = replaceRegex(blockquoteRegex, blockquoteReplacer);
  const replaceHorizontalRules = replaceRegex(horizontalRuleRegex, horizontalRuleReplacer);
  const replaceUnorderedLists = replaceRegex(unorderedListRegex, unorderedListReplacer);
  const replaceOrderedLists = replaceRegex(orderedListRegex, orderedListReplacer);
  const replaceParagraphs = replaceRegex(paragraphRegex, paragraphReplacer); // Fix for tab-indexed code blocks

  const codeBlockFixRegex = /\n(<pre>)((\n|.)*)(<\/pre>)/g;

  const codeBlockFixer = function (fullMatch, tagStart, tagContents, lastMatch, tagEnd) {
    let lines = '';
    tagContents.split('\n').forEach(line => {
      lines += line.substring(1) + '\n';
    });
    return tagStart + lines + tagEnd;
  };

  const fixCodeBlocks = replaceRegex(codeBlockFixRegex, codeBlockFixer); // Replacement rule order function for Markdown
  // Do not use as-is, prefer parseMarkdown as seen below

  const replaceMarkdown = function (str) {
    return replaceParagraphs(replaceOrderedLists(replaceUnorderedLists(replaceHorizontalRules(replaceBlockquotes(replaceceStrikethrough(replaceBoldItalics(replaceHeadings(replaceLinks(replaceImages(replaceInlineCodes(replaceCodeBlocks(str))))))))))));
  }; // Parser for Markdown (fixes code, adds empty lines around for parsing)
  // Usage: parseMarkdown(strVar)


  const parseMarkdown = function (str) {
    return fixCodeBlocks(replaceMarkdown('\n' + str + '\n')).trim();
  };

  return (str, values) => {
    values.newline = '\n';
    return parseMarkdown(dojo.string.substitute(str, values));
  };
})();

//# sourceMappingURL=solarstorm.js.map