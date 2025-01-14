/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
extern crate minidump_writer;

use anyhow;
use libc::pid_t;
use minidump_writer::crash_context::CrashContext;
use minidump_writer::minidump_writer::MinidumpWriter;
use nsstring::nsCString;
use std::ffi::CStr;
use std::mem;
use std::os::raw::c_char;

// This structure will be exposed to C++
#[repr(C)]
#[derive(Clone)]
pub struct InternalCrashContext {
    pub context: crash_context::ucontext_t,
    #[cfg(not(target_arch = "arm"))]
    pub float_state: crash_context::fpregset_t,
    pub siginfo: libc::signalfd_siginfo,
    pub pid: libc::pid_t,
    pub tid: libc::pid_t,
}

// This function will be exposed to C++
#[no_mangle]
pub unsafe extern "C" fn write_minidump_linux(
    dump_path: *const c_char,
    child: pid_t,
    child_blamed_thread: pid_t,
    error_msg: &mut nsCString,
) -> bool {
    assert!(!dump_path.is_null());
    let c_path = CStr::from_ptr(dump_path);
    let path = match c_path.to_str() {
        Ok(s) => s,
        Err(x) => {
            error_msg.assign(&format!(
                "Wrapper error. Path not convertable: {:#}",
                anyhow::Error::new(x)
            ));
            return false;
        }
    };

    let mut dump_file = match std::fs::OpenOptions::new()
        .create(true) // Create file if it doesn't exist
        .write(true) // Truncate file
        .open(path)
    {
        Ok(f) => f,
        Err(x) => {
            error_msg.assign(&format!(
                "Wrapper error when opening minidump destination at {:?}: {:#}",
                path,
                anyhow::Error::new(x)
            ));
            return false;
        }
    };

    match MinidumpWriter::new(child, child_blamed_thread).dump(&mut dump_file) {
        Ok(_) => {
            return true;
        }
        Err(x) => {
            error_msg.assign(&format!("{:#}", anyhow::Error::new(x)));
            return false;
        }
    }
}

// This function will be exposed to C++
#[no_mangle]
pub unsafe extern "C" fn write_minidump_linux_with_context(
    dump_path: *const c_char,
    child: pid_t,
    context: *const InternalCrashContext,
    error_msg: &mut nsCString,
) -> bool {
    assert!(!dump_path.is_null());
    let c_path = CStr::from_ptr(dump_path);

    assert!(!context.is_null());
    let cc: CrashContext = mem::transmute_copy(&(*(context as *const CrashContext)));
    let path = match c_path.to_str() {
        Ok(s) => s,
        Err(x) => {
            error_msg.assign(&format!(
                "Wrapper error. Path not convertable: {:#}",
                anyhow::Error::new(x)
            ));
            return false;
        }
    };

    let mut dump_file = match std::fs::OpenOptions::new()
        .create(true) // Create file if it doesn't exist
        .write(true) // Truncate file
        .open(path)
    {
        Ok(f) => f,
        Err(x) => {
            error_msg.assign(&format!(
                "Wrapper error when opening minidump destination at {:?}: {:#}",
                path,
                anyhow::Error::new(x)
            ));
            return false;
        }
    };

    match MinidumpWriter::new(child, cc.inner.tid)
        .set_crash_context(cc)
        .dump(&mut dump_file)
    {
        Ok(_) => {
            return true;
        }
        Err(x) => {
            error_msg.assign(&format!("{:#}", anyhow::Error::new(x)));
            return false;
        }
    }
}
