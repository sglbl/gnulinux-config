#!/bin/bash

bluetoothctl
sleep 10
echo "connect C8:2B:6B:62:99:3A" | bluetoothctl
sleep 12
echo "connect aa:bb:cc:dd:ee:ff" | bluetoothctl
exit
