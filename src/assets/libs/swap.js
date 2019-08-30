const SwapsNetwork = (() => {

  const parseURL = (url) => {
    var parser = document.createElement('a'),
      searchObject = {},
      queries, split, i;
    parser.href = url;
    queries = parser.search.replace(/^\?/, '').split('&');
    for( i = 0; i < queries.length; i++ ) {
      split = queries[i].split('=');
      searchObject[split[0]] = split[1];
    }
    return {
      protocol: parser.protocol,
      host: parser.host,
      hostname: parser.hostname,
      port: parser.port,
      pathname: parser.pathname,
      search: parser.search,
      searchObject: searchObject,
      hash: parser.hash
    };
  };

  const allScripts = document.getElementsByTagName('script');
  const currentScript = allScripts[allScripts.length - 1];


  const HTTP_KEY = parseURL(currentScript.src).searchObject.key;

  const API_URL = 'http://devswaps.mywish.io/';
  const API_PATH = 'api/v1/';

  const TOKENS_LIST_PATH = 'get_swap_tokens_api/';
  const SWAPS_PATH = 'create_swap_order/';
  const AUTH_PATH = 'get_swap_order_token/';


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
    CREATE_SWAP: {
      url: `${API_URL}${API_PATH}${SWAPS_PATH}`,
      options: {...INI_REQUEST_PARAMS, ...{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }}
    },
    AUTH: {
      url: `${API_URL}${API_PATH}${AUTH_PATH}`,
      options: {...INI_REQUEST_PARAMS, ...{
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Token': HTTP_KEY
          }
      }}
    }
  };

  const FIELDS_VALUES = {};

  class SwapsNetwork {
    constructor() {
      SwapsNetwork.auth().then((response) => {
        SwapsNetwork.getTokensList().then((result) => {
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
        }, (err) => {});
      });
    }


    static call(method, body) {
      const options = {...API_METHODS[method]['options']};
      options.body = body ? JSON.stringify(body) : undefined;

      if (method !== 'AUTH') {
        options.headers['Session-Token'] = this.sessionToken;
      }

      return fetch(API_METHODS[method]['url'], options).then(
        (response) => {
          if (response.ok) {
            return response.json();
          }
          switch (response.status) {
            case 403:
              return SwapsNetwork.auth().then(() => {
                return SwapsNetwork.call(method, body).then((res) => {
                  return res;
                });
              });
          }
        }
      );
    }



    static getClass(className) {
      return CLASS_PREFIX + '-' + className;
    }

    static auth() {
      return SwapsNetwork.call('AUTH', {user_id: 'undefined'}).then((response) => {
        this.sessionToken = response['session_token'];
        return response;
      });
    }

    static getTokensList() {
      return SwapsNetwork.call('GET_TOKENS_LIST');
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

    iniAmountMask(amountField, options) {
      const inputFilter = (value) => {
        value = value.replace(/,/g, '');
        return /^(\d+(\.?\d{0,8})?)?$/.test(value);
      };

      const maskValue = () => {
        const isDecimals = amountField.value.indexOf('.') > 0;
        const parsedNumber = amountField.value.split('.');
        const sizeNumber = parsedNumber[0].split(',').length - 1;
        let fieldValue = parsedNumber[0] = parsedNumber[0].replace(/,/g, '');

        let value = parsedNumber[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const newSizeNumber = value.split(',').length - 1;

        fieldValue+= (isDecimals && parsedNumber[1]) ? '.' + parsedNumber[1] : '';
        options.onchange(fieldValue);

        value+= (isDecimals ? '.' + (parsedNumber[1] || '') : '');
        let carretPosition;
        if (amountField.selectionStart === amountField.selectionEnd) {
          carretPosition = amountField.selectionStart + (newSizeNumber - sizeNumber);
        }
        amountField.value = value;
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

      for (let f in FIELDS_VALUES) {
        if (typeof FIELDS_VALUES[f] === 'string') {
          requestData[f] = FIELDS_VALUES[f];
        } else {
          requestData[f.split('_')[0] + '_coin_id'] = FIELDS_VALUES[f]['mywish_id'];
        }
      }


      return SwapsNetwork.call('CREATE_SWAP', requestData).then((response) => {
        return response;
      }, (error) => {
        return error;
      });

    }

    init(element, options) {

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


      submitBtn.onclick = () => {
        if (submitBtn.getAttribute('disabled')) {
          return;
        }
        SwapsNetwork.submitForm().then((result) => {
          resetForm();
          options.onSubmit ? options.onSubmit(result) : false;
        });
      };

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
  }

  return new SwapsNetwork();
})();

