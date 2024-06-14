# Cache 


## intro
Cache folder is generally responsible for housing scripts, tools, types, etc., associated with the data cache we keep on the ec2 (lep-dev).  

## Notes
As of **6/14/24**, The cache only contains json corresponding to the /bill/ endpoint of the congress.gov api. Cache can be found at `home/${EC2_USER_NAME}/bill-jsons/data/bill`. 

Cache file structure is as follows:
```
../
bill-jsons
 ├──cache-config.json
 ├── data
 │   ├── bill
 │   │   └── {congressNumber}
 │   │       └── {billType}
 │   │           ├── {billNumber}.json
 │   │           └── {billNumber}
 │   │               ├── committees.json
 │   │               └── actions.json
```
  
Most recent script is `audit-cache.ts`, which audits the cache and generates a health 
report. Conducts audits over ssh with an sftp client, so requires ssh access to ec2.

Auditing process goes something like this:  
1. set up ssh connection and sftp client, connect to ec2
2. load `cache-config.json`, which specifies congresses, bill types, and bill counts
3. for each congress, bill type, and bill number, audit associated files
4. generate a health report, write to `./cache/health-report-${reportName}.json`.
5. close ssh  

Requires the following `.env` variables:
```
NODE_ENV=
EC2_HOST_NAME=
EC2_USER_NAME=
SSH_KEY_PATH=
```
Note that `$SSH_KEY_PATH` is a path to your local key file, e.g. `~/.ssh/id_rsa`.  Script currently only works with `$NODE_ENV=development`. Will exit early if different value provided.





