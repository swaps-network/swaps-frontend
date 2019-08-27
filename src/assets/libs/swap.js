const SwapsNetwork = (() => {

  // const API_URL = 'https://swaps.network/';
  const API_URL = '/';
  const API_PATH = 'api/v1/';
  const TOKENS_LIST_PATH = 'get_coinmarketcap_tokens/';
  const SWAPS_PATH = '';

  const CLASS_PREFIX = 'w-sn';


  class SwapsNetwork {
    constructor() {

      this.windowBody = document.getElementsByTagName('body')[0];

      SwapsNetwork.getTokensList().then((result) => {
        this.tokensList = result.sort((a, b) => {
          return (a.rank || 100000) > (b.rank || 100000) ? 1 : -1;
        });
      }, (err) => {});
    }



    static getClass(className) {
      return CLASS_PREFIX + '-' + className;
    }

    static getTokensList() {
      return fetch(`${API_URL}${API_PATH}${TOKENS_LIST_PATH}`, {
        cache: 'no-cache',
        method: 'GET',
        header: {
          'Content-Type': 'application/json'
        }
      }).then(response => response.json());
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
        const seqrchQ = q.toLowerCase();

        const nameIndexMatch = tokenName.indexOf(seqrchQ) + 1;
        const symbolIndexMatch = tokenSymbol.indexOf(seqrchQ) + 1;

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
        close: closeAC
      };

    }

    iniAmountMask(amountField) {
      const inputFilter = (value) => {
        value = value.replace(/,/g, '');
        return /^(\d+(\.?\d{0,8})?)?$/.test(value);
      };
      const maskValue = () => {
        const isDecimals = amountField.value.indexOf('.') > 0;
        const parsedNumber = amountField.value.split('.');
        const sizeNumber = parsedNumber[0].split(',').length - 1;
        parsedNumber[0] = parsedNumber[0].replace(/,/g, '');
        let value = parsedNumber[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const newSizeNumber = value.split(',').length - 1;
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
      this.iniAmountMask(amountField);

      const chooseTokenButton = document.createElement('button');
      chooseTokenButton.setAttribute('type', 'button');
      chooseTokenButton.className = SwapsNetwork.getClass('one-field_inputs_bt');
      chooseTokenButton.innerText = options.button;
      fieldsBlock.appendChild(chooseTokenButton);

      const tokenAutoComplete = document.createElement('input');
      tokenAutoComplete.className = SwapsNetwork.getClass('one-field_inputs_token');
      tokenAutoComplete.setAttribute('placeholder', options.tokenPlaceholder);
      fieldsBlock.appendChild(tokenAutoComplete);

      const tokenAC = this.iniAutoComplete(tokenAutoComplete, {
        onSelectToken: (tokenItem) => {
          chooseTokenButton.innerHTML = '';
          tokenAutoComplete.classList.remove('w-sn-token-active');
          tokenAutoComplete.value = `${tokenItem.token_short_name} (${tokenItem.token_name})`;
          const btnIcon = document.createElement('img');
          btnIcon.setAttribute('src', tokenItem.image_link);
          btnIcon.className = SwapsNetwork.getClass('one-field_inputs_bt__icon');

          const btnTokenName = document.createElement('span');
          btnTokenName.innerText =  `${tokenItem.token_short_name} (${tokenItem.token_name})`;
          btnTokenName.className = SwapsNetwork.getClass('one-field_inputs_bt__name');

          chooseTokenButton.appendChild(btnIcon);
          chooseTokenButton.appendChild(btnTokenName);

          amountField.focus();
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
    }



    init(element, options) {
      const widgetContainer = document.createElement('div');
      widgetContainer.className = SwapsNetwork.getClass('wrapper');
      document.getElementById(element).appendChild(widgetContainer);

      const fieldsBlock = document.createElement('div');
      fieldsBlock.className = SwapsNetwork.getClass('fields');
      widgetContainer.appendChild(fieldsBlock);

      const tokenFirstField = document.createElement('div');
      tokenFirstField.className = SwapsNetwork.getClass('fields_block');

      this.iniTokenField(tokenFirstField, {
        label: 'You have',
        button: 'Choose Token',
        amountPlaceholder: 'Enter Amount',
        tokenPlaceholder: 'Search'
      });

      fieldsBlock.appendChild(tokenFirstField);

      const tokenSecondField = document.createElement('div');

      tokenSecondField.className = SwapsNetwork.getClass('fields_block');
      this.iniTokenField(tokenSecondField, {
        label: 'You want to get',
        button: 'Choose Token',
        amountPlaceholder: 'Enter Amount',
        tokenPlaceholder: 'Search'
      });
      fieldsBlock.appendChild(tokenSecondField);
    }
  }

  return new SwapsNetwork();
})();


window.onload = () => {
  SwapsNetwork.init('swaps-network-widget');
};

