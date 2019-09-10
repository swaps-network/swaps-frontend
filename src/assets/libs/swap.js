window.SwapsNetwork = (() => {

  const ordersStates = {
    CREATED: {
      INDEX: 0,
      TEXT: 'Created'
    },
    ACTIVE: {
      INDEX: 1,
      TEXT: 'Expires in'
    },
    DONE: {
      INDEX: 2,
      TEXT: 'Done'
    },
    CANCELLED: {
      INDEX: 3,
      TEXT: 'Cancelled'
    },
    EXPIRED: {
      INDEX: 4,
      TEXT: 'Expired'
    }
  };

  const API_URL = 'http://devswaps.mywish.io/';
  const API_PATH = 'api/v1/';

  const TOKENS_LIST_PATH = 'get_swap_tokens_api/';
  const SWAPS_PATH = 'create_swap_order/';

  const SWAP_ORDERS = 'get_swap3_orders/';
  const DELETE_ORDER_PATH = 'delete_order_for_user/';


  const CLASS_PREFIX = 'w-sn';

  const INI_REQUEST_PARAMS = {
    mode: 'cors',
  };

  const API_METHODS = {
    GET_TOKENS_LIST: {
      url: `${API_URL}${API_PATH}${TOKENS_LIST_PATH}`,
      options: {
        cache: 'no-cache',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    },
    GET_SWAP_ORDERS: {
      url: `${API_URL}${API_PATH}${SWAP_ORDERS}`,
      options: {
        cache: 'no-cache',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    },
    CREATE_SWAP: {
      url: `${API_URL}${API_PATH}${SWAPS_PATH}`,
      options: {...INI_REQUEST_PARAMS, ...{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }}
    },
    DELETE_ORDER: {
      url: `${API_URL}${API_PATH}${DELETE_ORDER_PATH}`,
      options: {...INI_REQUEST_PARAMS, ...{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }}
    }
  };

  const FIELDS_VALUES = {};
  let BASE_OPTIONS = {};


  class SwapsNetwork {
    constructor() {
      this.ordersList = [];
    }

    init(options) {
      BASE_OPTIONS = options;
      return SwapsNetwork.getOption('updateSessionToken')().then((sessionToken) => {
        BASE_OPTIONS.sessionToken = sessionToken;
        if (!this.tokensList) {
          return SwapsNetwork.getTokensList().then((result) => {
            this.tokensList = result.sort((a, b) => {
              return (a.rank || 100000) > (b.rank || 100000) ? 1 : -1;
            });
            this.tokensList.forEach((token) => {
              if (!token.platform && (token.token_short_name === 'ETH') && (token.token_name === 'Ethereum')) {
                token.platform = 'ethereum';
                token.isEther = true;
              }
              token.platform = token.platform || token.token_name.toLowerCase();
              token.isEthereum = token.platform === 'ethereum';
            });
            return this.tokensList;
          });
        } else {
          return new Promise((resolve, reject) => {
            resolve(this.tokensList);
          });
        }
      });
    }

    static call(method, body, promise) {
      const options = {...API_METHODS[method]['options']};
      options.body = body ? JSON.stringify(body) : undefined;
      options.headers['Session-Token'] = SwapsNetwork.getOption('sessionToken');

      const fetchCall = (resolve, reject) => {
        let originalResponse;
        const request = fetch(API_METHODS[method]['url'], options).then((response) => {
          originalResponse = response;
          return response.json();
        });

        return request.then((response) => {
          if (originalResponse.ok) {
            resolve(response);
            return;
          }
          switch (originalResponse.status) {
            case 403:
              return SwapsNetwork.getOption('updateSessionToken')().then((sessionToken) => {
                BASE_OPTIONS.sessionToken = sessionToken;
                return SwapsNetwork.call(method, body, {resolve, reject});
              });
            default:
              SwapsNetwork.getOption('onError')(response);
              reject(response);
          }
        });
      };

      if (promise) {
        return fetchCall(promise.resolve, promise.reject);
      }

      return new Promise((resolve, reject) => {
        fetchCall(resolve, reject);
      });
    }

    static getClass(className) {
      return CLASS_PREFIX + '-' + className;
    }

    static getOption(optionName) {
      return BASE_OPTIONS[optionName];
    }

    static getTokensList() {
      return SwapsNetwork.call('GET_TOKENS_LIST');
    }

    deleteOrder(orderId) {
      return SwapsNetwork.call('DELETE_ORDER', {order_id: orderId});
    }

    getSwapOrdersList() {
      return SwapsNetwork.call('GET_SWAP_ORDERS').then((result) => {
        result.sort((order1, order2) => {
          return (new Date(order1['created_date']) < new Date(order2['created_date'])) ? 1 : -1;
        });
        result.forEach((order) => {
          order.base_coin = this.tokensList.filter((token) => {
            return token.mywish_id === order.base_coin_id;
          })[0];
          order.quote_coin = this.tokensList.filter((token) => {
            return token.mywish_id === order.quote_coin_id;
          })[0];
        });
        return result;
      });
    }

    searchToken(q) {
      if (q.length < 2) {
        return false;
      }
      const result = [];

      let indexToken = 0;

      while ((indexToken < (this.tokensList.length - 1)) && (result.length < 10)) {
        const token = this.tokensList[indexToken];
        const tokenName = token.token_name.toLowerCase();
        const tokenSymbol = token.token_short_name.toLowerCase();
        const searchQ = q.toLowerCase();
        const nameIndexMatch = tokenName.indexOf(searchQ) + 1;
        const symbolIndexMatch = tokenSymbol.indexOf(searchQ) + 1;
        if (nameIndexMatch || symbolIndexMatch) {
          result.push({...token});
        }
        indexToken++;
      }
      return result;
    }

    iniAutoComplete(tokenFieldElement, options) {
      let oldVal;
      let searchResult;
      let selectedToken;

      let itemsResult;

      const tokensListContainer = document.createElement('div');
      tokensListContainer.className = SwapsNetwork.getClass('ac-container');


      ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach((eventName) => {
        tokenFieldElement.addEventListener(eventName, (event) => {
          if (tokenFieldElement.value !== oldVal) {
            oldVal = tokenFieldElement.value;
            searchResult = this.searchToken(tokenFieldElement.value);
            tokensListContainer.innerHTML = '';

            if (!searchResult) {
              if (tokensListContainer.parentNode === this.windowBody) {
                closeAC();
              }
            } else {
              itemsResult = [];
              searchResult.forEach((oneResultItem) => {
                addResultItem(oneResultItem);
              });
              if (itemsResult[0]) {
                selectToken(itemsResult[0], true);
              }
              this.windowBody.appendChild(tokensListContainer);
              setPositionTokensList();
            }
          }
        });
      });

      tokenFieldElement.addEventListener('keydown', (event) => {
        const selectedIndex = (itemsResult && itemsResult.length) ? itemsResult.indexOf(selectedToken) : false;
        let newIndex;
        switch (event.keyCode) {
          case 38:
            event.preventDefault();
            if (selectedIndex === false) return;
            newIndex = ((selectedIndex - 1) < 0) ? itemsResult.length - 1 : selectedIndex - 1;
            selectToken(itemsResult[newIndex], true);
            return false;
          case 40:
            event.preventDefault();
            if (selectedIndex === false) return;
            newIndex = ((selectedIndex + 1) > (itemsResult.length - 1)) ? 0 : selectedIndex + 1;
            selectToken(itemsResult[newIndex], true);
            return false;
          case 13:
            event.preventDefault();
            if (!isNaN(selectedIndex) && itemsResult[selectedIndex]) {
              selectToken(itemsResult[selectedIndex]);
            }
            return false;
        }
      });

      tokenFieldElement.addEventListener('blur', () => {
        closeAC();
      });

      tokenFieldElement.addEventListener('focus', () => {
        oldVal = tokenFieldElement.value;
        if (searchResult) {
          this.windowBody.appendChild(tokensListContainer);
          setPositionTokensList();
        }
      });

      const closeAC = () => {
        if (tokensListContainer.parentElement === this.windowBody) {
          this.windowBody.removeChild(tokensListContainer);
        }
      };

      const resetAC = () => {
        closeAC();
        selectedToken = undefined;
        tokensListContainer.innerHTML = '';
        itemsResult = [];
      };

      const selectToken = (tokenItem, onlyItem) => {
        if (selectedToken && (selectedToken.element !== tokenItem.element)) {
          selectedToken.element.classList.remove(SwapsNetwork.getClass('ac-item__active'));
        }
        selectedToken = tokenItem;
        selectedToken.element.classList.add(SwapsNetwork.getClass('ac-item__active'));
        if (!onlyItem) {
          options.onSelectToken(tokenItem.data);
          closeAC();
        }

        setTimeout(() => {
          const activeItem = tokenItem.element;
          const bottomPosition = activeItem.offsetTop + activeItem.offsetHeight;
          const maxBottomPosition = tokensListContainer.scrollTop + tokensListContainer.offsetHeight;
          const heightRange = maxBottomPosition - bottomPosition;
          if (heightRange < 0) {
            tokensListContainer.scroll(0, tokensListContainer.scrollTop - heightRange);
          } else if (activeItem.offsetTop < tokensListContainer.scrollTop) {
            tokensListContainer.scroll(0, activeItem.offsetTop);
          }
        });

      };

      const addResultItem = (resultItem) => {
        const resultItemContainer = document.createElement('div');
        resultItemContainer.className = SwapsNetwork.getClass('ac-item');

        itemsResult.push({
          data: resultItem,
          element: resultItemContainer
        });

        resultItemContainer.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          return false;
        });

        resultItemContainer.addEventListener('click', () => {
          selectToken({
            data: resultItem,
            element: resultItemContainer
          });
        });

        const resultItemIcon = document.createElement('img');
        resultItemIcon.className = SwapsNetwork.getClass('ac-item_icon');

        const resultItemName = document.createElement('span');
        resultItemName.className = SwapsNetwork.getClass('ac-item_name');

        resultItemIcon.setAttribute('src', resultItem.image_link);
        resultItemName.innerText = `${resultItem.token_short_name} (${resultItem.token_name})`;

        resultItemContainer.appendChild(resultItemIcon);
        resultItemContainer.appendChild(resultItemName);

        tokensListContainer.appendChild(resultItemContainer);
      };

      const setPositionTokensList = () => {
        const tokenFieldElementPosition = tokenFieldElement.getBoundingClientRect();
        tokensListContainer.style.left = tokenFieldElementPosition.left + 'px';
        tokensListContainer.style.top = (tokenFieldElementPosition.top + tokenFieldElement.offsetHeight) + 'px';
        tokensListContainer.style.width = tokenFieldElement.offsetWidth + 'px';
      };
      return {
        close: closeAC,
        reset: resetAC
      };
    }

    static formatDate(date) {
      let d = date;
      d = [
        '0' + d.getDate(),
        '0' + (d.getMonth() + 1),
        '' + d.getFullYear(),
        '0' + d.getHours(),
        '0' + d.getMinutes()
      ].map(component => component.slice(-2));
      return d.slice(0, 3).join('.') + ' ' + d.slice(3).join(':');
    }

    static getFormattedNumber(number, decimals) {
      number = number.toString();
      const isDecimals = number.indexOf('.') > 0;
      const parsedNumber = number.split('.');

      let fieldValue = parsedNumber[0] = parsedNumber[0].replace(/,/g, '');
      let value = parsedNumber[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");


      if (isDecimals && (decimals !== undefined) && parsedNumber[1]) {
        const regExp = new RegExp('^([0-9]{0,' + decimals + '}).*$', 'g');
        parsedNumber[1] = parsedNumber[1].replace(regExp, '$1');
      }

      fieldValue+= (isDecimals && parsedNumber[1]) ? '.' + parsedNumber[1] : '';
      value+= (isDecimals ? '.' + (parsedNumber[1] || '') : '');

      return {
        value,
        fieldValue
      };
    }

    iniAmountMask(amountField, options) {
      const inputFilter = (value) => {
        value = value.replace(/,/g, '');
        return /^(\d+(\.?\d{0,8})?)?$/.test(value);
      };

      const maskValue = () => {
        const newValue = SwapsNetwork.getFormattedNumber(amountField.value);

        const sizeNumber = amountField.value.split('.')[0].split(',').length - 1;
        const newSizeNumber = newValue.value.split('.')[0].split(',').length - 1;

        options.onchange(newValue.fieldValue);

        let carretPosition;

        if (amountField.selectionStart === amountField.selectionEnd) {
          carretPosition = amountField.selectionStart + (newSizeNumber - sizeNumber);
        }

        amountField.value = newValue.value;
        if (carretPosition) {
          amountField.setSelectionRange(carretPosition, carretPosition);
        }
      };
      ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop"].forEach(function(event) {
        amountField.addEventListener(event, function() {
          if (inputFilter(this.value)) {
            if (this.oldValue === this.value) {
              return;
            }
            this.oldValue = this.value;
            this.oldSelectionStart = this.selectionStart;
            this.oldSelectionEnd = this.selectionEnd;
            maskValue();
          } else if (this.hasOwnProperty("oldValue")) {
            this.value = this.oldValue;
            this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
          }
        });
      });
    }

    iniTokenField(fieldElement, options) {

      const fieldContainer = document.createElement('div');
      fieldContainer.className = SwapsNetwork.getClass('one-field');
      fieldElement.appendChild(fieldContainer);

      const fieldLabel = document.createElement('div');
      fieldLabel.className = SwapsNetwork.getClass('one-field_label');
      fieldLabel.innerText = options.label;
      fieldContainer.appendChild(fieldLabel);

      const fieldsBlock = document.createElement('div');
      fieldsBlock.className = SwapsNetwork.getClass('one-field_inputs');
      fieldContainer.appendChild(fieldsBlock);

      const amountField = document.createElement('input');
      amountField.className = SwapsNetwork.getClass('one-field_inputs_amount');
      amountField.setAttribute('placeholder', options.amountPlaceholder);
      fieldsBlock.appendChild(amountField);
      this.iniAmountMask(amountField, {
        onchange: (amount) => {
          FIELDS_VALUES[options.fields.amount] = amount;
          options.changeState();
        }
      });

      const chooseTokenButton = document.createElement('button');
      chooseTokenButton.setAttribute('type', 'button');
      chooseTokenButton.className = SwapsNetwork.getClass('one-field_inputs_bt');
      fieldsBlock.appendChild(chooseTokenButton);

      const tokenAutoComplete = document.createElement('input');
      tokenAutoComplete.className = SwapsNetwork.getClass('one-field_inputs_token');
      tokenAutoComplete.setAttribute('placeholder', options.tokenPlaceholder);
      fieldsBlock.appendChild(tokenAutoComplete);

      const resetFields = () => {
        FIELDS_VALUES[options.fields.token] = null;
        FIELDS_VALUES[options.fields.amount] = null;
        tokenAutoComplete.value = '';
        amountField.value = '';
        chooseTokenButton.innerText = options.button;
        options.changeState();
        tokenAC.reset();
      };


      const tokenAC = this.iniAutoComplete(tokenAutoComplete, {
        onSelectToken: (tokenItem) => {
          chooseTokenButton.innerHTML = '';
          tokenAutoComplete.classList.remove('w-sn-token-active');
          tokenAutoComplete.value = `${tokenItem.token_short_name} (${tokenItem.token_name})`;
          const btnIcon = document.createElement('img');
          btnIcon.setAttribute('src', tokenItem.image_link);
          btnIcon.className = SwapsNetwork.getClass('one-field_inputs_bt__icon');

          const btnTokenName = document.createElement('span');
          btnTokenName.innerText =  `${tokenItem.token_short_name}`;
          btnTokenName.className = SwapsNetwork.getClass('one-field_inputs_bt__name');

          chooseTokenButton.appendChild(btnIcon);
          chooseTokenButton.appendChild(btnTokenName);

          amountField.focus();

          FIELDS_VALUES[options.fields.token] = {...tokenItem};
          options.changeState();
        }
      });

      const tokenFieldCloser = document.createElement('button');
      tokenFieldCloser.setAttribute('type', 'button');
      tokenFieldCloser.className = SwapsNetwork.getClass('one-field_inputs_closer');
      tokenFieldCloser.appendChild(document.createElement('span'));
      fieldsBlock.appendChild(tokenFieldCloser);

      chooseTokenButton.addEventListener('click', function() {
        tokenAutoComplete.classList.add('w-sn-token-active');
        setTimeout(() => {
          tokenAutoComplete.focus();
        }, 250);
      });

      tokenFieldCloser.addEventListener('click', function() {
        tokenAutoComplete.classList.remove('w-sn-token-active');
        tokenAC.close();
        amountField.focus();
      });

      resetFields();

      return resetFields;
    }

    static validateForm() {
      let valid = true;
      for (let fieldName in FIELDS_VALUES) {
        if (!FIELDS_VALUES[fieldName]) {
          valid = false;
          break;
        }
      }

      return valid;
    }

    static submitForm() {
      const requestData = {};
      const tokensNames = {};
      for (let f in FIELDS_VALUES) {
        if (typeof FIELDS_VALUES[f] === 'string') {
          requestData[f] = FIELDS_VALUES[f];
        } else {
          const typeToken = f.split('_')[0];
          tokensNames[typeToken] = FIELDS_VALUES[f]['token_short_name'];
          requestData[f.split('_')[0] + '_coin_id'] = FIELDS_VALUES[f]['mywish_id'];
        }
      }
      requestData.name = tokensNames['base'] + '<>' + tokensNames['quote'];

      return SwapsNetwork.call('CREATE_SWAP', requestData);

    }

    drawForm(element, options) {

      this.windowBody = document.getElementsByTagName('body')[0];

      const widgetContainer = document.createElement('div');
      widgetContainer.className = SwapsNetwork.getClass('wrapper');
      document.getElementById(element).appendChild(widgetContainer);

      const fieldsBlock = document.createElement('div');
      fieldsBlock.className = SwapsNetwork.getClass('fields');
      widgetContainer.appendChild(fieldsBlock);

      const buttonBlock = document.createElement('div');
      buttonBlock.className = SwapsNetwork.getClass('submit-btn');
      widgetContainer.appendChild(buttonBlock);

      const submitBtn = document.createElement('button');
      submitBtn.className = SwapsNetwork.getClass('submit-btn_control');
      buttonBlock.appendChild(submitBtn);

      const textButton = document.createElement('span');
      submitBtn.appendChild(textButton);
      submitBtn.setAttribute('disabled', 'disabled');

      textButton.innerText = 'Create';

      const resetForm = () => {
        resetBaseFields();
        resetQuoteFields();
      };

      const submitForm = () => {
        if (submitBtn.getAttribute('disabled')) {
          return;
        }
        submitBtn.setAttribute('disabled', 'disabled');
        SwapsNetwork.submitForm().then((result) => {
          resetForm();
          options.onSubmit ? options.onSubmit(result) : false;
        }, (error) => {
          options.createError ? options.createError(error) : false;
        }).finally(() => {
          submitBtn.removeAttribute('disabled');
        });
      };


      submitBtn.onclick = submitForm;


      const tokenFirstField = document.createElement('div');
      tokenFirstField.className = SwapsNetwork.getClass('fields_block');

      const checkState = () => {
        if (!SwapsNetwork.validateForm()) {
          submitBtn.setAttribute('disabled', 'disabled');
        } else {
          submitBtn.removeAttribute('disabled');
        }
      };

      const resetBaseFields = this.iniTokenField(tokenFirstField, {
        label: 'You have',
        button: 'Choose Token',
        amountPlaceholder: 'Enter Amount',
        tokenPlaceholder: 'Search',
        fields: {
          token: 'base_token',
          amount: 'base_limit'
        },
        changeState: checkState
      });
      fieldsBlock.appendChild(tokenFirstField);

      const tokenSecondField = document.createElement('div');
      tokenSecondField.className = SwapsNetwork.getClass('fields_block');
      const resetQuoteFields = this.iniTokenField(tokenSecondField, {
        label: 'You want to get',
        button: 'Choose Token',
        amountPlaceholder: 'Enter Amount',
        tokenPlaceholder: 'Search',
        fields: {
          token: 'quote_token',
          amount: 'quote_limit'
        },
        changeState: checkState
      });

      fieldsBlock.appendChild(tokenSecondField);
    }

    static getTokenCellNode(coin) {
      const tokenCellElement = document.createElement('div');
      tokenCellElement.className = SwapsNetwork.getClass('order-item_cell');
      tokenCellElement.classList.add(SwapsNetwork.getClass('order-item_cell__token'));
      const tokenContent = document.createElement('div');
      tokenContent.className = SwapsNetwork.getClass('order-content');
      const tokenName = document.createElement('div');
      tokenName.className = SwapsNetwork.getClass('order-content_token-name');
      const tokenIcon = document.createElement('img');
      tokenIcon.className = SwapsNetwork.getClass('order-content_token-name_icon');
      tokenIcon.setAttribute('src', coin.image_link);
      const tokenSymbol = document.createElement('span');
      tokenSymbol.className = SwapsNetwork.getClass('order-content_token-name_symbol');
      tokenSymbol.innerText = coin.token_short_name;
      tokenName.appendChild(tokenIcon);
      tokenName.appendChild(tokenSymbol);
      tokenContent.appendChild(tokenName);
      tokenCellElement.appendChild(tokenContent);
      return tokenCellElement;
    }

    static getVolumeCellNode(params) {
      const limitCellElement = document.createElement('div');
      limitCellElement.className = SwapsNetwork.getClass('order-item_cell');
      limitCellElement.classList.add(SwapsNetwork.getClass('order-item_cell__amount'));
      const limitContent = document.createElement('div');
      limitContent.className = SwapsNetwork.getClass('order-content');
      const volume = document.createElement('div');
      volume.className = SwapsNetwork.getClass('order-content_token-volume');
      const volumeLimit = document.createElement('div');
      volumeLimit.className = SwapsNetwork.getClass('order-content_token-volume_limit');
      volumeLimit.innerText = SwapsNetwork.getFormattedNumber(params.limit1, 8).value  + ' ' +
        params.coin1.token_short_name;

      const volumeRate = document.createElement('div');
      volumeRate.className = SwapsNetwork.getClass('order-content_token-volume_price');
      volumeRate.innerText =
        SwapsNetwork.getFormattedNumber(params.limit1 / params.limit2, 4).value + ' ' +
        params.coin1.token_short_name + '/' + params.coin2.token_short_name;

      volume.appendChild(volumeLimit);
      volume.appendChild(volumeRate);
      limitContent.appendChild(volume);
      limitCellElement.appendChild(limitContent);
      return limitCellElement;
    }

    static getOrderNode(order, options) {

      const orderItemElement = document.createElement('div');
      options.parent.appendChild(orderItemElement);

      orderItemElement.className = SwapsNetwork.getClass('order-item');

      // Base token info
      orderItemElement.appendChild(SwapsNetwork.getTokenCellNode(order.base_coin));


      // Base limit info
      orderItemElement.appendChild(SwapsNetwork.getVolumeCellNode({
        limit1: order.base_limit,
        limit2: order.quote_limit,
        coin1: order.base_coin,
        coin2: order.quote_coin
      }));


      // Quote limit info
      orderItemElement.appendChild(SwapsNetwork.getVolumeCellNode({
        limit2: order.base_limit,
        limit1: order.quote_limit,
        coin2: order.base_coin,
        coin1: order.quote_coin
      }));


      // Quote token info
      orderItemElement.appendChild(SwapsNetwork.getTokenCellNode(order.quote_coin));

      // Status and expired info
      const dateCellElement = document.createElement('div');
      dateCellElement.className = SwapsNetwork.getClass('order-item_cell');
      dateCellElement.classList.add(SwapsNetwork.getClass('order-item_cell__expire-in'));
      const dateContent = document.createElement('div');
      dateContent.className = SwapsNetwork.getClass('order-content');
      const orderStatus = document.createElement('div');
      orderStatus.className = SwapsNetwork.getClass('order-status');
      orderStatus.classList.add(SwapsNetwork.getClass('order-status') + '__' + ordersStates[order.state].INDEX);


      orderStatus.innerText = ordersStates[order.state].TEXT;

      const orderExpireDate = document.createElement('div');
      orderExpireDate.className = SwapsNetwork.getClass('order-date');
      orderExpireDate.innerText = SwapsNetwork.formatDate(new Date(order.stop_date));

      dateContent.appendChild(orderStatus);

      if (ordersStates[order.state].INDEX === 1) {
        dateContent.appendChild(orderExpireDate);
      }

      dateCellElement.appendChild(dateContent);
      orderItemElement.appendChild(dateCellElement);


      // Delete button
      const deleteOrderBtnContent = document.createElement('div');
      deleteOrderBtnContent.className = SwapsNetwork.getClass('order-delete');

      const deleteOrderBtn = document.createElement('button');
      deleteOrderBtn.className = SwapsNetwork.getClass('order-delete_btn');
      deleteOrderBtnContent.appendChild(deleteOrderBtn);

      orderItemElement.appendChild(deleteOrderBtnContent);

      deleteOrderBtn.onclick = () => {
        deleteOrderBtn.setAttribute('disabled', 'disabled');
        options.deleteMethod(order.id);
      };

      return orderItemElement;
    }

    drawOrdersList(element) {
      const blockNode = document.getElementById(element);
      const ordersListNode = document.createElement('div');
      ordersListNode.className = SwapsNetwork.getClass('orders_list');

      const deleteOrder = (orderId) => {
        return this.deleteOrder(orderId).then((result) => {
          this.drawOrdersList(element);
          return result;
        });
      };

      return this.getSwapOrdersList().then((ordersList) => {

        ordersList.forEach((order) => {
          if (!this.ordersList.filter((currOrderItem) => {
            return currOrderItem.order.id === order.id;
          }).length) {
            this.ordersList.unshift({
              order: order,
              element: SwapsNetwork.getOrderNode(order, {
                parent: ordersListNode,
                deleteMethod: deleteOrder
              })
            });
          }
        });

        this.ordersList = this.ordersList.filter((currOrderItem) => {
          return ordersList.filter((newOrder) => {
            return newOrder.id === currOrderItem.order.id;
          }).length;
        });

        this.ordersList.forEach((orderItem) => {
          ordersListNode.appendChild(orderItem.element);
        });

        blockNode.innerHTML = '';
        blockNode.appendChild(ordersListNode);

        return {
          ordersList: this.ordersList,
          refresh: () => {
            this.drawOrdersList(element);
          },
          deleteOrder: deleteOrder
        };
      });
    }
  }

  return new SwapsNetwork();
})();
