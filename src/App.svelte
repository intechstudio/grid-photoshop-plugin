<script>
  import "./global.css";
  import { onMount } from "svelte";

  import { batchPlayInModal, decodeBase64, uxpLog } from "./utils";

  import { app, core } from "photoshop";

  const appRef = {
    _ref: "application",
    _enum: "ordinal",
    _value: "targetEnum",
  };
  const docRef = { _ref: "document", _enum: "ordinal", _value: "targetEnum" };

  let currentTool;

  let selectedCommand = {};
  async function performMenuCommand(commandId) {
    uxpLog(1, "in-progress");

    await core
      .getMenuCommandState({ commandID: commandId })
      .then((res) => {
        /*
        uxpLog(2, res)
        HERE WE COULD CHECK IF COMMAND IS AVAILABLE TO BE RUN
        */
      })
      .catch((err) => {});

    await core
      .performMenuCommand({ commandID: commandId })
      .then((res) => uxpLog(2, res))
      .catch((err) => uxpLog(0, err.message));
  }

  let menuBar;
  async function buildCommandCollection() {
    menuBar = await getPropety("menuBarInfo", appRef)
      .then((res) => {
        return res.menuBarInfo.submenu;
      })
      .catch((err) => {
        return err;
      });

    let commandCollection = [];
    function crawlSubmenu(name, array) {
      // iterate on input array, check if it has submenu
      array.forEach((element) => {
        // if the array element has submenu, check the name of current depth and go deeper
        if (element.submenu) {
          let nextName = "";
          if (name == "") {
            // name == '' if it's starting the recursion
            nextName = element.name;
          } else {
            nextName = name + " | " + element.name;
          }
          crawlSubmenu(nextName, element.submenu);
        } else {
          commandCollection.push({
            category: name,
            name: element.name,
            enabled: element.enabled,
            visible: element.visible,
            command: element.command,
          });
        }
      });
    }

    crawlSubmenu("", menuBar);

    console.log("menu collection:", commandCollection);
  }

  let uiInfo = [];
  async function buildUiInfo() {
    uiInfo = await getPropety("tools", appRef)
      .then((res) => {
        return res.tools.filter((t) => t.inToolBar == true);
      })
      .catch((err) => {
        return err;
      });
  }

  let newStuffToDo = [];

  let hasValueChanged;
  let latestValue = { method: "", body: {} };
  let isBatchPlayBusy = false;

  function processUpdates(opts, value) {
    if (isBatchPlayBusy == false) {
      isBatchPlayBusy = true;
      hasValueChanged = false;
      changeBrushTipShape(opts, value).then(function () {
        isBatchPlayBusy = false;
        if (hasValueChanged == true) {
          hasValueChanged = false;
          processUpdates(opts, latestValue.body);
        } else {
          console.log("done", value);
        }
      });
    }
  }

  let toolOptions = {};
  async function callMessageHandler(params) {
    console.log("do it here... ");

    // websocket_send('{"plugin": "photoshop", "data": {"toolId": 1}}')

    // this is only recalculated if the latestValue body differs from next message body
    // TODO... check for different methods as well!
    if (!Object.keys(latestValue.body).includes(...Object.keys(params.body))) {
      toolOptions = await getPropety("currentToolOptions", appRef).then(
        (res) => res.currentToolOptions
      );
    }

    latestValue = params;
    hasValueChanged = true;

    processUpdates(toolOptions, latestValue.body);
  }

  async function changeBrushTipShape(toolOptions, brushParams) {
    console.log("bruh", brushParams);

    const brush = toolOptions.brush;

    for (const param in brushParams) {
      brush[param]._value = brushParams[param];
    }

    const actionJSON = [
      {
        _obj: "set",
        _target: {
          _ref: "brush",
          _enum: "ordinal",
          _value: "targetEnum",
        },
        to: {
          _obj: "brush",
          ...brush,
        },
        _options: {
          dialogOptions: "dontDisplay", // silent
        },
      },
    ];

    const batchPlayOptions = {
      synchronousExecution: false,
    };

    console.log("EHHEE");

    const result = await batchPlayInModal(actionJSON, batchPlayOptions)
      .then((res) => {
        return "done";
      })
      .catch((err) => {
        return "err" + err;
      });

    console.log("DONE", result);

    return result;
  }

  let webSocketClient = undefined;
  let webSocketUrl = "ws://localhost:1337";
  let connectionCheckInterval = 2000;
  let receivedMessages = [];
  let wsClientStatus = undefined;

  function connectToWebSocket() {
    if (webSocketClient) {
      console.info("WebSocket is already connected, disconnect first.");
      return;
    }

    webSocketClient = new WebSocket(webSocketUrl);

    webSocketClient.addEventListener("open", function () {
      wsClientStatus = "open";
      console.info("WS is open");
    });

    webSocketClient.addEventListener("close", function (event) {
      wsClientStatus = "closed";
      webSocketClient = null;
    });

    webSocketClient.addEventListener("error", function (event) {
      wsClientStatus = "error";
      console.info("WS error", event);
    });

    webSocketClient.addEventListener("message", function (event) {
      receivedMessages.push(event.data);

      const EDITOR_PACKET = JSON.parse(event.data);

      switch (EDITOR_PACKET["event"]) {
        case "message":
          if (EDITOR_PACKET.data != undefined) {
            const decodedMessage = JSON.parse(EDITOR_PACKET.data);
            if (decodedMessage.plugin == "photoshop") {
              callMessageHandler(decodedMessage);
            }
          }
          break;
        case "grid_ping":
          webSocketClient.send(JSON.stringify({ event: "grid_pong" }));
          break;
        default:
      }
    });
  }

  setInterval(() => {
    connectToWebSocket();
  }, connectionCheckInterval);

  onMount(async () => {
    await buildUiInfo();
    await buildCommandCollection();
    connectToWebSocket();
  });

  async function changeBrushShapeDynamics(brushParams) {
    const { currentToolOptions } = await getPropety(
      "currentToolOptions",
      appRef
    );

    // runs only, if current tool option has brush property

    if (currentToolOptions) {
      for (const param in brushParams) {
        currentToolOptions[param] = brushParams[param];
      }

      const actionJSON = [
        {
          _obj: "set",
          _target: [{ _ref: "paintbrushTool" }],
          to: currentToolOptions,
          _options: {
            //dialogOptions: "dontDisplay"
          },
        },
      ];

      const batchPlayOptions = {
        synchronousExecution: false,
        //modalBehavior: "wait"
      };

      //uxpLog(1, 'batch-play-in-progress');
      await batchPlayInModal(actionJSON, batchPlayOptions)
        .then((res) => {
          //uxpLog(2,res);

          return res;
        })
        .catch((err) => {
          //uxpLog(0, err.message);
          return err;
        });
    }
  }

  async function changePaintbrushTool(brushParams) {
    const { currentToolOptions } = await getPropety(
      "currentToolOptions",
      appRef
    );

    // runs only, if current tool option has brush property

    if (currentToolOptions) {
      for (const param in brushParams) {
        currentToolOptions[param] = brushParams[param];
      }

      const actionJSON = [
        {
          _obj: "set",
          _target: [{ _ref: "paintbrushTool" }],
          to: currentToolOptions,
          _options: {
            //dialogOptions: "dontDisplay"
          },
        },
      ];

      const batchPlayOptions = {
        synchronousExecution: false,
        //modalBehavior: "wait"
      };

      //uxpLog(1, 'batch-play-in-progress');
      const result = await batchPlayInModal(actionJSON, batchPlayOptions)
        .then((res) => {
          //uxpLog(2,res);
          return res;
        })
        .catch((err) => {
          //uxpLog(0, err.message);
          return err;
        });
    }
  }

  async function getPropety(propertyName, ref = appRef) {
    // example: panelList, menuBarInfo

    const actionJSON = [
      {
        _obj: "get",
        _target: [{ _property: propertyName }, ref],
      },
    ];

    const batchPlayOptions = {
      synchronousExecution: false,
    };

    //uxpLog(1, 'batch-play-in-progress');
    const result = await batchPlayInModal(actionJSON, batchPlayOptions)
      .then((res) => {
        //uxpLog(2,res);
        return res;
      })
      .catch((err) => {
        //uxpLog(0, err.message);
        return err;
      });

    return result;
  }

  async function setTool(toolId) {
    const actionJSON = [
      {
        _obj: "select",
        _target: [
          {
            _ref: toolId,
          },
        ],
        _options: {
          dialogOptions: "dontDisplay",
        },
      },
    ];

    const batchPlayOptions = {
      synchronousExecution: false,
    };

    uxpLog(1, "batch-play-in-progress");
    const result = await batchPlayInModal(actionJSON, batchPlayOptions)
      .then((res) => {
        uxpLog(2, res);
        return res;
      })
      .catch((err) => {
        uxpLog(0, err.message);
        return err;
      });

    return result;
  }

  async function changeZoom(zv) {
    /**  
    const currentZoom = await getPropety("zoom", docRef).then(res => res[0]["zoom"]._value)
    */

    const actionJSON = [
      {
        _obj: "set",
        _target: [{ _property: "zoom" }, docRef],
        to: {
          zoom: {
            _value: zv,
            _unit: "percentUnit",
          },
        },
        _options: {
          dialogOptions: "silent",
        },
      },
    ];

    const batchPlayOptions = {
      synchronousExecution: false,
    };

    uxpLog(1, "batch-play-in-progress");
    const result = await batchPlayInModal(actionJSON, batchPlayOptions)
      .then((res) => {
        uxpLog(2, res);
        return res;
      })
      .catch((err) => {
        uxpLog(0, err.message);
        return err;
      });
    return result;
  }
</script>

<div class="flex flex-col">
  {#if wsClientStatus == "closed"}
    <div class="text-yellow-500">Connection with Grid Editor is closed.</div>
  {:else if wsClientStatus == "open"}
    <div class="text-green-500">Connection with Grid Editor is open.</div>
  {:else}
    <div class="text-yellow-500">Connection with Grid Editor is lost.</div>
  {/if}

  <div>
    {new Date().getHours() +
      ":" +
      new Date().getMinutes() +
      ":" +
      new Date().getSeconds() +
      " " +
      JSON.stringify(latestValue)}
  </div>
</div>

<style>
</style>
