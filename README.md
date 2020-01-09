# grafana-riverbed-netim

This datasource plugin allows Grafana to submit requests to Riverbed SteelCentral NetIM.

Data retrieved are shown in panel (graph, heatmap, table ...).

This plugin is fully native, it replace this older one who required a Python server to be runned : https://github.com/Crinon/outDated-Grafana-Datasource-Plugin-For-Riverbed-NetIM


## Installation

Place this folder in the plugins directory /var/lib/grafana/plugins

Run ```npm install```to build node_modules folder

Run ```npm run build```to build dist folder

You may need to reboot your Grafana server to complete plugin installation




### Dev setup

This plugin requires node 6.10.0

```
npm install -g yarn
yarn install
npm run build
```



### Changelog

1.0.0
- Release
