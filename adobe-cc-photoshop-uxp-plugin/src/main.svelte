<script lang="ts">
  import { uxp, indesign, photoshop } from "./globals";
  import { api } from "./api/api";
  import boltUxpLogo from "./assets/bolt-uxp.png";
  import viteLogo from "./assets/vite.png";
  import tsLogo from "./assets/typescript.png";
  import sassLogo from "./assets/sass.png";
  import svelteLogo from "./assets/svelte.png";
  import { onMount } from "svelte";
  import { psAppRef } from "./lib/variables";
  import { batchPlayInModal, getPropety } from "./lib/uxp";

  let count: number = 0;
  const increment = () => (count += 1);

  const hostName = (uxp.host.name as string).toLowerCase();

  //* Call Functions Conditionally by App
  if (hostName === "photoshop") {
    console.log("Hello from Photoshop", photoshop);
  }

  //* Or call the unified API object directly and the correct app function will be used
  const helloWorld = () => {
    api.notify("Hello World");
  };

  let uiInfo = [];
  async function buildUiInfo() {
    uiInfo = await getPropety("tools", psAppRef)
      .then((res) => {
        return res.tools.filter((t) => t.inToolBar == true);
      })
      .catch((err) => {
        return err;
      });
    console.log("List of UI items", uiInfo);
  }

  let webSocketClient: WebSocket | undefined = undefined;
  let webSocketUrl = "ws://localhost:1337";
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
      webSocketClient = undefined;
    });

    webSocketClient.addEventListener("error", function (event) {
      wsClientStatus = "error";
      console.info("WS error", event);
    });

    webSocketClient.addEventListener("message", function (event) {
      const EDITOR_PACKET = JSON.parse(event.data);

      switch (EDITOR_PACKET["event"]) {
        case "message":
          if (EDITOR_PACKET.data != undefined) {
            const decodedMessage = JSON.parse(EDITOR_PACKET.data);

            console.log(decodedMessage);
            callMessageHandler(decodedMessage);
          }
          break;
        case "grid_ping":
          // reply for package health check
          webSocketClient.send(JSON.stringify({ event: "grid_pong" }));
          break;
        default:
      }
    });
  }

  let hasValueChanged;
  let latestValue = { method: "", body: {} };
  let isBatchPlayBusy = false;

  let toolOptions = {};
  async function callMessageHandler(params) {
    console.log("do it here... ", params);

    // websocket_send('{"plugin": "photoshop", "data": {"toolId": 1}}')

    // this is only recalculated if the latestValue body differs from next message body
    // TODO... check for different methods as well!
    // if (!Object.keys(latestValue.body).includes(...Object.keys(params.body))) {
    //   toolOptions = await getPropety("currentToolOptions", appRef).then(
    //     (res) => res.currentToolOptions,
    //   );
    // }

    toolOptions = await getPropety("currentToolOptions", psAppRef).then(
      (res) => res.currentToolOptions,
    );

    latestValue = params;
    hasValueChanged = true;

    console.log(toolOptions, latestValue.body);

    processUpdates(toolOptions, latestValue.body);
  }

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

  // CODE JUST COPIED, NOT TESTED
  async function changePaintbrushTool(brushParams) {
    const { currentToolOptions } = await getPropety(
      "currentToolOptions",
      psAppRef,
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

  // CODE JUST COPIED, NOT TESTED
  async function changeBrushShapeDynamics(brushParams) {
    const { currentToolOptions } = await getPropety(
      "currentToolOptions",
      appRef,
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

  async function performMenuCommand(commandId) {
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
      .catch((err) => console.info(err));
  }

  let menuBar;
  async function buildCommandCollection() {
    menuBar = await getPropety("menuBarInfo", psAppRef)
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
  }

  onMount(async () => {
    await buildUiInfo();
    await buildCommandCollection();
    console.log("menubar items", menuBar);
    connectToWebSocket();
  });
</script>

<main>
  <div>
    <img class="logo-lg" src={boltUxpLogo} alt="" />
  </div>
  <div class="stack-icons">
    <img src={viteLogo} class="logo" alt="" />
    <span> + </span>
    <img src={svelteLogo} class="logo" alt="" />
    <span> + </span>
    <img src={tsLogo} class="logo" alt="" />
    <span> + </span>
    <img src={sassLogo} class="logo" alt="" />
  </div>
  <div class="button-group">
    <button on:click={increment}>
      count is {count}
    </button>
    <button on:click={helloWorld}>Hello World</button>
  </div>
  <div>
    <p>
      Edit <span class="code">main.svelte</span> and save to test HMR updates.
    </p>
  </div>
  <div class="button-group">
    <a href="https://github.com/hyperbrew/bolt-uxp/">Bolt UXP Docs</a>
    <a href="https://svelte.dev">Svelte Docs</a>
    <a href="https://vitejs.dev/">Vite Docs</a>
  </div>
</main>

<style lang="scss">
  @import "./variables.scss";
</style>
