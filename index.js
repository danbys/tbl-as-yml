#!/usr/bin/env node
import { fileWatcher } from './converter.js';
import s3Artifacts from '@danbys/s3-artifacts';
fileWatcher();
s3Artifacts.checkForNewerVersions();